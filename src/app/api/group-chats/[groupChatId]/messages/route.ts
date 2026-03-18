import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getOpenRouterErrorMessage,
  resolveOpenRouterApiKey,
  resolveOpenRouterModel,
  resolveOpenRouterReferer,
} from '@/lib/openrouterServer'
import { buildContentRatingInstruction, NSFW_ROLEPLAY_RULES, ROLEPLAY_FORMATTING_INSTRUCTIONS } from '@/lib/roleplayFormatting'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

/** Maximum number of sequential bot replies triggered between two human messages. */
const MAX_MULTI_BOT_TURNS = 3

type GroupChatContext = {
  id: string
  name: string
  creator_id: string
  group_type: 'general' | 'roleplay' | 'ttrpg'
  rules: string | null
  universe: string | null
  persona_relationship_context: string | null
  dm_mode: 'user' | 'bot' | null
  dm_bot_id: string | null
  is_nsfw: boolean
}

type GroupBot = {
  id: string
  name: string
  personality: string
  avatar_url: string | null
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string } | string | unknown
  message?: unknown
}

type GroupMessageRow = {
  id: string
  group_chat_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string
}

type GenerationMessage = {
  sender_id: string
  content: string
}

type UserPersona = {
  name: string
  description: string
}

type UserSender = {
  id: string
  username: string | null
  avatar_url: string | null
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) return null
  return user
}

async function ensureGroupMember(groupChatId: string, userId: string) {
  const { data, error } = await serviceClient()
    .from('group_chat_members')
    .select('id')
    .eq('group_chat_id', groupChatId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return !!data
}

function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage
    }
  }

  return fallback
}

function isLikelySenderIdConstraintError(error: unknown) {
  const message = getErrorMessage(error, '').toLowerCase()
  return (
    message.includes('sender_id') &&
    (
      message.includes('invalid input syntax for type uuid') ||
      message.includes('violates foreign key constraint') ||
      message.includes('is not present in table')
    )
  )
}

function pickRespondingBot(
  group: GroupChatContext,
  bots: GroupBot[],
  triggerMessageId: string,
  excludedBotIds: Set<string> = new Set()
) {
  if (bots.length === 0) return null

  const availableBots = bots.filter((bot) => !excludedBotIds.has(bot.id))
  const candidates = availableBots.length > 0 ? availableBots : bots

  if (group.group_type === 'ttrpg' && group.dm_mode === 'bot' && group.dm_bot_id) {
    const dmBot = candidates.find((bot) => bot.id === group.dm_bot_id)
    if (dmBot) return dmBot
  }

  const numericSeed = triggerMessageId
    .replace(/-/g, '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  return candidates[numericSeed % candidates.length]
}

function buildGroupModePrompt(group: GroupChatContext) {
  if (group.group_type === 'ttrpg') {
    return [
      'This is a TTRPG-style group chat.',
      group.rules ? `Table rules: ${group.rules}` : null,
      group.universe ? `Campaign setting: ${group.universe}` : null,
      group.persona_relationship_context
        ? `Relationship map to user persona: ${group.persona_relationship_context}`
        : null,
      'Keep replies immersive, scene-aware, and concise.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (group.group_type === 'roleplay') {
    return [
      'This is a roleplay group chat. MULTIPLE characters are present.',
      group.universe ? `Universe: ${group.universe}` : null,
      group.rules ? `Roleplay rules: ${group.rules}` : null,
      group.persona_relationship_context
        ? `Relationship map to user persona: ${group.persona_relationship_context}`
        : null,
      '### **GROUP DYNAMICS (CRITICAL)**',
      '- Stay in-character and respond naturally to the latest turn.',
      '- If a character is explicitly speaking to someone else, do not hijack the conversation. You may react physically or observe, but do not interrupt their dialogue.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    'This is a casual group chat with users and bots.',
    'Keep your response short and conversational unless asked for detail.',
  ].join('\n')
}

function buildOfflineFallbackReply({
  group,
  bot,
  userMessage,
}: {
  group: GroupChatContext
  bot: GroupBot
  userMessage: string
}) {
  const trimmed = userMessage.trim()
  const shortMessage = trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed

  if (group.group_type === 'ttrpg') {
    return `${bot.name} leans into the scene. "I hear you: ${shortMessage}. Let's move this encounter forward together."`
  }

  if (group.group_type === 'roleplay') {
    return `${bot.name} stays in-character. "${shortMessage}... noted. I am responding from within this world."`
  }

  return `${bot.name}: "Got it, ${shortMessage}. I'm here and listening."`
}

function resolveBotFromMessage(
  message: GroupMessageRow,
  botsById: Map<string, GroupBot>,
  botsByName: Map<string, GroupBot>
) {
  const senderId = String(message.sender_id || '')

  if (senderId.startsWith('bot_')) {
    const rawId = senderId.slice(4)
    const byPrefixedId = botsById.get(rawId)
    if (byPrefixedId) return byPrefixedId
  }

  const byExactId = botsById.get(senderId)
  if (byExactId) return byExactId

  const content = String(message.content || '')
  const prefixMatch = content.match(/^\[([^\]]+)\]\s+/)
  if (prefixMatch) {
    const botName = prefixMatch[1]?.trim().toLowerCase()
    if (botName) {
      const byName = botsByName.get(botName)
      if (byName) return byName
    }
  }

  return null
}

function isMessageFromBotId(senderId: string, botId: string) {
  const normalizedSenderId = senderId.trim()
  return normalizedSenderId === botId || normalizedSenderId === `bot_${botId}`
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

async function getUserSenders(svc: ReturnType<typeof serviceClient>, messages: GroupMessageRow[]) {
  const senderIds = Array.from(
    new Set(messages.map((message) => String(message.sender_id || '').trim()).filter(Boolean))
  )

  const userIds = senderIds.filter((id) => isUuid(id))
  if (userIds.length === 0) {
    return new Map<string, UserSender>()
  }

  const { data, error } = await svc
    .from('users')
    .select('id, username, avatar_url')
    .in('id', userIds)

  if (error) {
    console.error('Failed to load user sender metadata:', getErrorMessage(error))
    return new Map<string, UserSender>()
  }

  const rows = (data || []) as Array<{ id: string; username: string | null; avatar_url: string | null }>
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        username: row.username,
        avatar_url: row.avatar_url,
      },
    ])
  )
}

function decorateMessagesWithSenderMeta(
  messages: GroupMessageRow[],
  bots: GroupBot[],
  usersById: Map<string, UserSender>
) {
  const botsById = new Map(bots.map((bot) => [bot.id, bot]))
  const botsByName = new Map(bots.map((bot) => [bot.name.trim().toLowerCase(), bot]))

  return messages.map((message) => {
    const matchedBot = resolveBotFromMessage(message, botsById, botsByName)

    if (!matchedBot) {
      const userSender = usersById.get(String(message.sender_id || ''))
      return {
        ...message,
        sender_is_bot: false,
        sender_name: userSender?.username ?? null,
        sender_avatar_url: userSender?.avatar_url ?? null,
      }
    }

    return {
      ...message,
      sender_is_bot: true,
      sender_name: matchedBot.name,
      sender_avatar_url: matchedBot.avatar_url,
    }
  })
}

async function getActiveUserPersona(
  svc: ReturnType<typeof serviceClient>,
  groupChatId: string,
  userId: string,
  requestedPersonaId?: string | null
): Promise<{ persona: UserPersona | null; warning: string | null }> {
  let personaId: string | null = null

  if (requestedPersonaId !== undefined) {
    // User explicitly set (or cleared) their persona — persist the choice on the member record.
    await svc
      .from('group_chat_members')
      .update({ persona_id: requestedPersonaId || null })
      .eq('group_chat_id', groupChatId)
      .eq('user_id', userId)
    personaId = requestedPersonaId || null
  } else {
    // No explicit choice in this request — fall back to the stored persona for this member.
    const { data } = await svc
      .from('group_chat_members')
      .select('persona_id')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', userId)
      .maybeSingle()
    personaId = (data as { persona_id?: string | null } | null)?.persona_id ?? null
  }

  if (!personaId) return { persona: null, warning: null }

  const { data: personaRow, error: personaError } = await svc
    .from('personas')
    .select('name, description')
    .eq('id', personaId)
    .eq('user_id', userId)
    .maybeSingle()

  if (personaError || !personaRow) {
    return { persona: null, warning: 'Could not load user persona' }
  }

  const row = personaRow as { name?: unknown; description?: unknown }
  return {
    persona: {
      name: String(row.name || ''),
      description: String(row.description || ''),
    },
    warning: null,
  }
}

async function generateBotReply({
  group,
  bot,
  recentMessages,
  latestTriggerMessage,
  botsById,
  userPersona,
}: {
  group: GroupChatContext
  bot: GroupBot
  recentMessages: Array<{ sender_id: string; content: string }>
  latestTriggerMessage: string
  botsById: Map<string, GroupBot>
  userPersona: UserPersona | null
  // is_nsfw is read from group.is_nsfw
}) {
  const openrouterApiKey = resolveOpenRouterApiKey()
  if (!openrouterApiKey) {
    return {
      content: buildOfflineFallbackReply({ group, bot, userMessage: latestTriggerMessage }),
      warning: 'OPENROUTER_API_KEY is not configured on the server; using offline fallback reply',
    }
  }

  const model = resolveOpenRouterModel('openrouter/auto')

  const personaLine = userPersona
    ? `The user you are speaking with is playing as ${userPersona.name}${userPersona.description ? `: ${userPersona.description}` : ''}.`
    : 'The user is chatting as themselves.'

  const criticalRules = [
    '### **CRITICAL ROLEPLAY RULES**',
    `- ALWAYS stay in character as ${bot.name}.`,
    `- NEVER write dialogue, actions, or internal thoughts for ${userPersona?.name || 'the user'}.`,
    '- Drive the narrative forward but leave room for the other participants to respond.',
    '- Only produce your own in-character message. Do not narrate or speak for other characters.',
  ].join('\n')

  const systemPrompt = [
    `You are ${bot.name}. ${bot.personality}`,
    personaLine,
    buildContentRatingInstruction(group.is_nsfw),
    buildGroupModePrompt(group),
    criticalRules,
    ROLEPLAY_FORMATTING_INSTRUCTIONS,
    ...(group.is_nsfw ? [NSFW_ROLEPLAY_RULES] : []),
  ]
    .filter(Boolean)
    .join('\n\n')

  const messageHistory = recentMessages.map((message) => {
    const senderId = String(message.sender_id || '')
    const isCurrentBot = isMessageFromBotId(senderId, bot.id)

    if (isCurrentBot) {
      return { role: 'assistant' as const, content: message.content }
    }

    // Identify the sender so the bot understands who said what
    const normalizedSenderId = senderId.startsWith('bot_') ? senderId.slice(4) : senderId
    const senderBot = botsById.get(normalizedSenderId)
    const senderLabel = senderBot ? senderBot.name : 'User'
    return {
      role: 'user' as const,
      content: `[${senderLabel}]: ${message.content}`,
    }
  })

  try {
    const openrouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': resolveOpenRouterReferer(),
        'X-Title': 'Botainy',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messageHistory,
        ],
        temperature: 0.85,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
      }),
    })

    const payload: OpenRouterResponse | null = await openrouterResp.json().catch(() => null)
    if (!openrouterResp.ok) {
      return {
        content: buildOfflineFallbackReply({ group, bot, userMessage: latestTriggerMessage }),
        warning: getOpenRouterErrorMessage(
          payload,
          `OpenRouter returned status ${openrouterResp.status}`
        ),
      }
    }

    return {
      content:
        payload?.choices?.[0]?.message?.content?.trim() ||
        buildOfflineFallbackReply({ group, bot, userMessage: latestTriggerMessage }),
      warning: payload?.choices?.[0]?.message?.content?.trim()
        ? null
        : 'OpenRouter returned an empty response; using offline fallback reply',
    }
  } catch (error: unknown) {
    return {
      content: buildOfflineFallbackReply({ group, bot, userMessage: latestTriggerMessage }),
      warning: `${getErrorMessage(error, 'OpenRouter request failed')}; using offline fallback reply`,
    }
  }
}

async function persistBotMessage({
  groupChatId,
  bot,
  content,
  fallbackHumanSenderId,
}: {
  groupChatId: string
  bot: GroupBot
  content: string
  fallbackHumanSenderId: string
}) {
  const svc = serviceClient()
  const candidateSenderIds = [`bot_${bot.id}`, bot.id]

  for (const senderId of candidateSenderIds) {
    const { data, error } = await svc
      .from('group_chat_messages')
      .insert({
        group_chat_id: groupChatId,
        sender_id: senderId,
        content,
      })
      .select('id, group_chat_id, sender_id, content, created_at, updated_at')
      .single()

    if (!error) return { message: data, error: null }
    if (!isLikelySenderIdConstraintError(error)) {
      return { message: null, error: getErrorMessage(error, 'Failed to persist bot response') }
    }
  }

  // Backward-compatible fallback for databases where sender_id is still UUID-constrained.
  const { data: fallbackData, error: fallbackError } = await svc
    .from('group_chat_messages')
    .insert({
      group_chat_id: groupChatId,
      sender_id: fallbackHumanSenderId,
      content: `[${bot.name}] ${content}`,
    })
    .select('id, group_chat_id, sender_id, content, created_at, updated_at')
    .single()

  return fallbackError
    ? { message: null, error: getErrorMessage(fallbackError, 'Failed to persist bot response') }
    : { message: fallbackData, error: null }
}

async function getGroupContext(svc: ReturnType<typeof serviceClient>, groupChatId: string) {
  const { data, error } = await svc
    .from('group_chats')
    .select('*')
    .eq('id', groupChatId)
    .maybeSingle()

  if (error || !data) {
    return {
      group: null,
      warning: error ? getErrorMessage(error, 'Failed to load group chat context') : 'Group chat not found',
    }
  }

  const row = data as Record<string, unknown>
  const normalizedGroupType =
    row.group_type === 'roleplay' || row.group_type === 'ttrpg' ? row.group_type : 'general'
  const normalizedDmMode = row.dm_mode === 'bot' || row.dm_mode === 'user' ? row.dm_mode : null

  const group: GroupChatContext = {
    id: String(row.id || groupChatId),
    name: String(row.name || 'Group Chat'),
    creator_id: String(row.creator_id || ''),
    group_type: normalizedGroupType,
    rules: typeof row.rules === 'string' ? row.rules : null,
    universe: typeof row.universe === 'string' ? row.universe : null,
    persona_relationship_context:
      typeof row.persona_relationship_context === 'string' ? row.persona_relationship_context : null,
    dm_mode: normalizedDmMode,
    dm_bot_id: typeof row.dm_bot_id === 'string' ? row.dm_bot_id : null,
    is_nsfw: row.is_nsfw === true,
  }

  return { group, warning: null }
}

async function getGroupBots(svc: ReturnType<typeof serviceClient>, groupChatId: string) {
  const { data: links, error: linksError } = await svc
    .from('group_chat_bots')
    .select('bot_id')
    .eq('group_chat_id', groupChatId)

  if (linksError) {
    return {
      bots: [] as GroupBot[],
      warning: getErrorMessage(linksError, 'Failed to load group bots'),
    }
  }

  const botIds = Array.from(
    new Set((links || []).map((row) => String((row as { bot_id?: string }).bot_id || '')).filter(Boolean))
  )

  if (botIds.length === 0) {
    return { bots: [] as GroupBot[], warning: 'No bots are attached to this group chat' }
  }

  const { data: botRows, error: botError } = await svc
    .from('bots')
    .select('id, name, personality, avatar_url')
    .in('id', botIds)

  if (botError) {
    return {
      bots: [] as GroupBot[],
      warning: getErrorMessage(botError, 'Failed to load bot details'),
    }
  }

  const bots = (botRows || [])
    .map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || 'Bot'),
      personality: String(row.personality || ''),
      avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    }))
    .filter((bot) => bot.id.length > 0)

  if (bots.length === 0) {
    return { bots: [] as GroupBot[], warning: 'Group bot links exist, but bot records were not found' }
  }

  return { bots, warning: null }
}

async function getRecentMessagesForGeneration(
  svc: ReturnType<typeof serviceClient>,
  groupChatId: string
) {
  const { data, error } = await svc
    .from('group_chat_messages')
    .select('sender_id, content, created_at')
    .eq('group_chat_id', groupChatId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return {
      messages: [] as GenerationMessage[],
      warning: getErrorMessage(error, 'Failed to load recent group messages'),
    }
  }

  const rows = (data || []) as Array<{ sender_id: string; content: string; created_at: string }>
  const messages = rows
    .slice()
    .reverse()
    .map((row) => ({ sender_id: String(row.sender_id || ''), content: String(row.content || '') }))

  return { messages, warning: null }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    const member = await ensureGroupMember(groupChatId, user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const svc = serviceClient()
    const { bots } = await getGroupBots(svc, groupChatId)

    const { data, error } = await svc
      .from('group_chat_messages')
      .select('id, group_chat_id, sender_id, content, created_at, updated_at')
      .eq('group_chat_id', groupChatId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const messageRows = (data || []) as GroupMessageRow[]
    const usersById = await getUserSenders(svc, messageRows)

    return NextResponse.json(decorateMessagesWithSenderMeta(messageRows, bots, usersById))
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    const member = await ensureGroupMember(groupChatId, user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const content = String(body?.content || '').trim()
    if (!content) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }

    // Resolve the active persona for the message sender.
    // If the client sends a `personaId` field (including null to clear), persist and use that.
    // Otherwise fall back to the persona stored on the member record from a previous message.
    const hasPersonaId = Object.prototype.hasOwnProperty.call(body, 'personaId')
    const requestedPersonaId = hasPersonaId
      ? (typeof body.personaId === 'string' && body.personaId.trim() ? body.personaId.trim() : null)
      : undefined

    const svc = serviceClient()
    const { persona: userPersona } = await getActiveUserPersona(svc, groupChatId, user.id, requestedPersonaId)
    const { bots: groupBots } = await getGroupBots(svc, groupChatId)
    const { data, error } = await svc
      .from('group_chat_messages')
      .insert({
        group_chat_id: groupChatId,
        sender_id: user.id,
        content,
      })
      .select('id, group_chat_id, sender_id, content, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const userMapForInitial = await getUserSenders(svc, [data as GroupMessageRow])
    const initialDecorated = decorateMessagesWithSenderMeta(
      [data as GroupMessageRow],
      groupBots,
      userMapForInitial
    )
    const userMessage = initialDecorated[0] || data

    let botWarning: string | null = null
    let botMessage: Record<string, unknown> | null = null
    const botMessages: Record<string, unknown>[] = []

    // Bot responses are best-effort; user message delivery should still succeed even if bots fail.
    try {
      const { group, warning: groupWarning } = await getGroupContext(svc, groupChatId)
      if (groupWarning) {
        console.error('Group chat context warning:', groupWarning)
        botWarning = groupWarning
      }

      if (group) {
        const bots = groupBots
        const botsWarning = bots.length === 0 ? 'No bots are attached to this group chat' : null
        if (botsWarning) {
          console.error('Group chat bots warning:', botsWarning)
          botWarning = botsWarning
        }

        // Allow up to MAX_MULTI_BOT_TURNS bot-to-bot exchanges per user message when multiple bots are present.
        const maxBotTurns = bots.length > 1 ? MAX_MULTI_BOT_TURNS : 1
        let triggerMessage = data as GroupMessageRow
        const botsById = new Map(bots.map((bot) => [bot.id, bot]))
        const botsByName = new Map(bots.map((bot) => [bot.name.trim().toLowerCase(), bot]))

        for (let turn = 0; turn < maxBotTurns; turn += 1) {
          const triggerBot = resolveBotFromMessage(triggerMessage, botsById, botsByName)

          // Only exclude the bot that sent the trigger message so it doesn't respond to itself.
          // Other bots may respond again in later turns, enabling natural bot-to-bot conversation.
          const excludedBotIds = new Set<string>()
          if (triggerBot) {
            excludedBotIds.add(triggerBot.id)
          }

          const respondingBot = pickRespondingBot(
            group,
            bots,
            `${triggerMessage.id}:${turn}`,
            excludedBotIds
          )
          if (!respondingBot) break

          const { messages: recentMessages, warning: recentMessagesWarning } =
            await getRecentMessagesForGeneration(svc, groupChatId)

          if (recentMessagesWarning) {
            console.error('Group chat recent message warning:', recentMessagesWarning)
            botWarning = recentMessagesWarning
          }

          const generationMessages = recentMessages.length
            ? recentMessages
            : [{ sender_id: String(data.sender_id || user.id), content: String(data.content || content) }]

          const botReply = await generateBotReply({
            group,
            bot: respondingBot,
            recentMessages: generationMessages,
            latestTriggerMessage: triggerMessage.content,
            botsById,
            userPersona,
          })

          if (botReply.warning) {
            console.error('Group chat bot generation warning:', botReply.warning)
            botWarning = botReply.warning
          }

          if (!botReply.content) {
            break
          }

          const persistResult = await persistBotMessage({
            groupChatId,
            bot: respondingBot,
            content: botReply.content,
            fallbackHumanSenderId: group.creator_id,
          })

          if (persistResult.error) {
            console.error('Group chat bot persist warning:', persistResult.error)
            botWarning = persistResult.error
            break
          }

          if (!persistResult.message) {
            break
          }

          const botMessageRow = persistResult.message as GroupMessageRow
          const botUserMap = await getUserSenders(svc, [botMessageRow])
          const decoratedBot = decorateMessagesWithSenderMeta(
            [persistResult.message as GroupMessageRow],
            bots,
            botUserMap
          )
          const decorated = (decoratedBot[0] || persistResult.message) as Record<string, unknown>

          if (!botMessage) {
            botMessage = decorated
          }

          botMessages.push(decorated)
          triggerMessage = botMessageRow
          generationMessages.push({
            sender_id: String(botMessageRow.sender_id || ''),
            content: String(botMessageRow.content || ''),
          })

          if (generationMessages.length > 20) {
            generationMessages.splice(0, generationMessages.length - 20)
          }
        }
      }
    } catch (botError: unknown) {
      const errorMessage = getErrorMessage(botError)
      console.error('Failed to generate group chat bot response:', errorMessage)
      botWarning = errorMessage
    }

    return NextResponse.json(
      {
        userMessage,
        botMessage,
        botMessages,
        bot_warning: botWarning,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
