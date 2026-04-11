/**
 * Encounter Engine
 *
 * Provides signal parsing, bot selection, context injection, and signal
 * stripping for the TTRPG encounter system. Works in-memory — no DB schema
 * changes required. State is derived from recent message history each request.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** DM emits this to open an encounter. Payload is the creature/encounter name. */
const SIGNAL_START = /\[START_ENCOUNTER:\s*([^\]]+?)\s*\]/gi

/** DM emits this to close the encounter and resume narration. */
const SIGNAL_END = /\[END_ENCOUNTER\]/gi

/** Encounter bot emits this when its morale breaks. Triggers DM narration. */
const SIGNAL_DEFEATED = /\[DEFEATED\]/gi

/** DM emits this to define the turn order. Payload is comma-separated bot names. */
const SIGNAL_INIT_QUEUE = /\[INIT_QUEUE:\s*([^\]]+?)\s*\]/gi

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EncounterState = 'idle' | 'active' | 'defeated'

export type EncounterContext = {
  state: EncounterState
  /** Name token from [START_ENCOUNTER:...] — matches an Encounter bot name */
  activeEncounterName: string | null
  /** Ordered list of bot IDs in the initiative queue */
  initiativeQueue: string[]
  /** Index of whose turn it currently is in the queue */
  initiativeIndex: number
}

// ---------------------------------------------------------------------------
// Signal parsing
// ---------------------------------------------------------------------------

/**
 * Scans the last N messages (most-recent-last) and derives the current
 * EncounterContext from embedded signals. No DB writes occur.
 */
export function deriveEncounterContext(
  messages: Array<{ sender_id: string; content: string }>,
  botsByName: Map<string, { id: string }>
): EncounterContext {
  let state: EncounterState = 'idle'
  let activeEncounterName: string | null = null
  let initiativeQueue: string[] = []
  let initiativeIndex = 0

  for (const msg of messages) {
    const text = msg.content

    // START_ENCOUNTER
    for (const match of [...text.matchAll(SIGNAL_START)]) {
      state = 'active'
      activeEncounterName = match[1]?.trim() || null
      initiativeIndex = 0
    }

    // INIT_QUEUE — resets turn order
    for (const match of [...text.matchAll(SIGNAL_INIT_QUEUE)]) {
      const names = (match[1] || '')
        .split(',')
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean)
      const ids: string[] = []
      for (const name of names) {
        const bot = botsByName.get(name)
        if (bot) ids.push(bot.id)
      }
      if (ids.length > 0) {
        initiativeQueue = ids
        initiativeIndex = 0
      }
    }

    // DEFEATED — encounter is over, DM resumes
    if (SIGNAL_DEFEATED.test(text)) {
      state = 'defeated'
    }
    SIGNAL_DEFEATED.lastIndex = 0

    // END_ENCOUNTER — fully closed, reset
    if (SIGNAL_END.test(text)) {
      state = 'idle'
      activeEncounterName = null
      initiativeQueue = []
      initiativeIndex = 0
    }
    SIGNAL_END.lastIndex = 0
  }

  // Advance queue index based on how many bot messages appeared after the last
  // INIT_QUEUE signal — keeps turns progressing even between requests.
  if (state === 'active' && initiativeQueue.length > 0) {
    let queueStart = -1
    for (let i = 0; i < messages.length; i++) {
      if (SIGNAL_INIT_QUEUE.test(messages[i].content)) queueStart = i
      SIGNAL_INIT_QUEUE.lastIndex = 0
    }
    if (queueStart >= 0) {
      let turns = 0
      for (let i = queueStart + 1; i < messages.length; i++) {
        const sid = messages[i].sender_id
        const looksBotSent = sid.startsWith('bot_') || initiativeQueue.includes(sid)
        if (looksBotSent) turns += 1
      }
      initiativeIndex = turns % initiativeQueue.length
    }
  }

  return { state, activeEncounterName, initiativeQueue, initiativeIndex }
}

// ---------------------------------------------------------------------------
// Bot selection
// ---------------------------------------------------------------------------

/**
 * Resolves which bot should respond next, honouring the encounter state and
 * @mention overrides. Returns null if no suitable bot is found.
 *
 * Priority order:
 *  1. @mention in the player message (overrides queue for a reactive response)
 *  2. Encounter mode — currently queued Encounter bot
 *  3. Exploration mode — DM bot
 *  4. Fallback — deterministic seed pick from non-excluded bots
 */
export function pickEncounterBot<T extends { id: string; name: string; personality: string }>(opts: {
  bots: T[]
  dmBotId: string | null
  encounterCtx: EncounterContext
  playerMessage: string
  triggerSeed: string
  excludedBotIds: Set<string>
}): T | null {
  const { bots, dmBotId, encounterCtx, playerMessage, triggerSeed, excludedBotIds } = opts

  if (bots.length === 0) return null

  const available = bots.filter((b) => !excludedBotIds.has(b.id))
  const candidates = available.length > 0 ? available : bots

  // 1. @mention override
  const mentionMatch = playerMessage.match(/@([\w\s-]+)/i)
  if (mentionMatch) {
    const mentionedName = mentionMatch[1].trim().toLowerCase()
    const mentioned = candidates.find((b) => b.name.trim().toLowerCase() === mentionedName)
    if (mentioned) return mentioned
  }

  // 2. Encounter active — honour initiative queue
  if (encounterCtx.state === 'active' && encounterCtx.initiativeQueue.length > 0) {
    const currentId = encounterCtx.initiativeQueue[encounterCtx.initiativeIndex]
    const queuedBot = candidates.find((b) => b.id === currentId)
    if (queuedBot) return queuedBot
  }

  // 3. Encounter active but no queue — pick an Encounter bot by name match
  if (encounterCtx.state === 'active' && encounterCtx.activeEncounterName) {
    const nameLower = encounterCtx.activeEncounterName.toLowerCase()
    const encounterBot = candidates.find((b) => {
      const p = b.personality || ''
      return (
        b.name.trim().toLowerCase() === nameLower ||
        p.includes('TTRPG Role: Encounter')
      )
    })
    if (encounterBot) return encounterBot
  }

  // 4. Defeated or idle — DM bot leads
  if ((encounterCtx.state === 'idle' || encounterCtx.state === 'defeated') && dmBotId) {
    const dmBot = candidates.find((b) => b.id === dmBotId)
    if (dmBot) return dmBot
  }

  // 5. Deterministic seed fallback
  const seed = triggerSeed
    .replace(/-/g, '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  return candidates[seed % candidates.length] ?? null
}

// ---------------------------------------------------------------------------
// Encounter context injection (Shared Blackboard)
// ---------------------------------------------------------------------------

/**
 * Builds the "Lite sheet" injected into the DM bot's context during an active
 * encounter. Always present so the DM can adjudicate at any point.
 */
export function buildEncounterLiteSheet(encounterBot: { name: string; personality: string }): string {
  const p = encounterBot.personality || ''

  // Extract key fields from the stored personality string
  const fields: Record<string, string> = {}
  const patterns: Array<[string, string]> = [
    ['Creature Name', 'creatureName'],
    ['Danger Level / CR', 'cr'],
    ['Combat Role', 'combatRole'],
    ['Abilities / Actions', 'abilities'],
  ]
  for (const [label, key] of patterns) {
    const match = p.match(new RegExp(`${label}:\\s*([^\\n]+)`))
    if (match?.[1] && match[1].trim() !== 'N/A') fields[key] = match[1].trim()
  }

  const lines = [
    '### **ACTIVE ENCOUNTER — LITE SHEET (DM Reference)**',
    `Creature: ${fields.creatureName ?? encounterBot.name}`,
    fields.cr ? `CR / Danger: ${fields.cr}` : null,
    fields.combatRole ? `Combat Role: ${fields.combatRole}` : null,
    fields.abilities ? `Abilities: ${fields.abilities}` : null,
    'Use this to adjudicate outcomes when players ask for rulings.',
  ]

  return lines.filter(Boolean).join('\n')
}

/**
 * Builds the full encounter sheet injected when the DM is the primary
 * responder during combat (e.g. for terrain/rules questions).
 */
export function buildEncounterFullSheet(encounterBot: { name: string; personality: string }): string {
  const p = encounterBot.personality || ''

  const liteSheet = buildEncounterLiteSheet(encounterBot)

  // Extract additional fields for the full sheet
  const extraPatterns: Array<[string, string]> = [
    ['Tactics / AI Logic', 'tactics'],
    ['Atmosphere', 'atmosphere'],
    ['Terrain Hazards', 'terrain'],
    ['Lighting / Visibility', 'lighting'],
    ['Morale Break', 'moraleBreak'],
    ['Objective', 'objective'],
    ['Escalation', 'escalation'],
    ['Harvestable Loot', 'loot'],
  ]
  const extras: string[] = []
  for (const [label] of extraPatterns) {
    const match = p.match(new RegExp(`${label}:\\s*([^\\n]+(?:\\n(?![A-Z][\\w /]+:)[^\\n]+)*)`))
    const val = match?.[1]?.trim()
    if (val && val !== 'N/A') extras.push(`${label}: ${val.replace(/\n/g, ' ')}`)
  }

  const lines = [liteSheet, '', '**Full Encounter Detail (DM Primary Responder)**', ...extras]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// DM signal injection instructions
// ---------------------------------------------------------------------------

/**
 * Returns instructions added to a DM bot's system prompt so it knows how to
 * emit encounter signals and manage the initiative queue.
 */
export function buildDmEncounterDirectives(
  dmBotId: string | null,
  bots: Array<{ id: string; name: string; personality: string }>,
  corebookName?: string | null,
  corebookUrl?: string | null,
): string {
  const encounterBots = bots.filter((b) => b.personality?.includes('TTRPG Role: Encounter'))
  const encounterBotNames = encounterBots.map((b) => b.name).join(', ')

  const lines = [
    '### **ENCOUNTER MANAGEMENT DIRECTIVES (CRITICAL — DM ONLY)**',
    'You are the Dispatcher. You control when combat starts and ends.',
  ]

  if (corebookName || corebookUrl) {
    lines.push('')
    lines.push('**Ruleset Reference:**')
    if (corebookName && corebookUrl) {
      lines.push(`Use the rules and monster stat blocks from **${corebookName}**: ${corebookUrl}`)
    } else if (corebookName) {
      lines.push(`Use the rules and monster stat blocks from **${corebookName}**.`)
    } else {
      lines.push(`Reference ruleset: ${corebookUrl}`)
    }
    lines.push('Apply that system\'s encounter mechanics, stat blocks, and rulings unless the group\'s house rules override them.')
  }

  lines.push(
    '',
    '**To start an encounter:**',
    'Narrate the scene, then on its own line emit: [START_ENCOUNTER: CreatureName]',
    'Immediately follow with the initiative order on its own line: [INIT_QUEUE: Bot1, Bot2, ...]',
    encounterBotNames ? `Encounter bots available in this group: ${encounterBotNames}` : 'No Encounter bots are currently in this group.',
    '',
    '**During an encounter:**',
    '- Each player turn, the queued Encounter bot responds first. You respond only if the player asks a rules question or addresses you directly.',
    '- Inject terrain or environmental rulings as needed.',
    '',
    '**To end an encounter:**',
    'When the Encounter bot emits [DEFEATED] or the situation resolves narratively, narrate the aftermath on its own line and emit: [END_ENCOUNTER]',
    '',
    'IMPORTANT: These signal tags are hidden from players. Only emit them when the narrative calls for it.',
  )

  return lines.join('\n')
}

/**
 * Returns instructions added to an Encounter bot's system prompt so it knows
 * how to signal defeat.
 */
export function buildEncounterBotDirectives(): string {
  return [
    '### **ENCOUNTER BOT DIRECTIVES (CRITICAL)**',
    'You are an Encounter creature controlled by the narrative.',
    'Fight according to your Tactics / AI Logic field. Target players per your Combat Role.',
    'When your Morale Break condition is met (or you are defeated), narrate your defeat, then on its own line emit: [DEFEATED]',
    'IMPORTANT: The [DEFEATED] tag is hidden from players. Only emit it once.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Signal stripping (call before DB write)
// ---------------------------------------------------------------------------

const ALL_SIGNALS = /\[(START_ENCOUNTER:[^\]]*|END_ENCOUNTER|DEFEATED|INIT_QUEUE:[^\]]*)\]/gi

/**
 * Removes all hidden encounter signal tags from a bot response before it is
 * persisted to the database. Players only see the narrative text.
 * Collapses any resulting blank lines produced by the removal.
 */
export function stripEncounterSignals(text: string): string {
  return text
    .replace(ALL_SIGNALS, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
