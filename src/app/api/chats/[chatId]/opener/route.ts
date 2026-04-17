import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getOpenRouterErrorMessage,
  resolveOpenRouterApiKey,
  resolveOpenRouterModel,
  resolveOpenRouterReferer,
} from '@/lib/openrouterServer'
import {
  buildContentRatingInstruction,
  buildHardBoundariesGuardrail,
  buildToneInstruction,
  FOURTH_WALL_MUSIC_GUARDRAIL,
  NSFW_ROLEPLAY_RULES,
  ROLEPLAY_FORMATTING_INSTRUCTIONS,
} from '@/lib/roleplayFormatting'

type PersonaContext = { name: string; description: string | null }
type BotInfo = {
  name: string
  personality: string
  source_excerpts: string | null
  example_dialogues: Array<{ user: string; bot: string }> | null
  character_quotes: string[] | null
  default_tone: string | null
}
type RelationshipEvent = { id: string; date: string; description: string }
type ChatWithRelations = {
  id: string
  user_id: string
  bot_id: string
  is_nsfw: boolean | null
  api_temperature: number | null
  response_length: number | null
  narrative_style: number | null
  chat_tone: string | null
  bots: BotInfo | BotInfo[] | null
  personas: PersonaContext | PersonaContext[] | null
}
type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string } | string | unknown
}

function getSupabaseClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Server environment is missing required Supabase configuration')
  }

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey),
    serviceClient: createClient(supabaseUrl, serviceRoleKey),
  }
}

function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
  }
  return fallback
}

async function getAuthUser(req: NextRequest) {
  const { authClient } = getSupabaseClients()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user) return null
  return user
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function buildResponseLengthInstruction(responseLength: number | null | undefined): string | null {
  if (responseLength === 0) return '### **RESPONSE LENGTH**\nKeep your response very short — 1 paragraph at most.'
  if (responseLength === 1) return '### **RESPONSE LENGTH**\nKeep your response short and concise — aim for 1 to 2 paragraphs.'
  if (responseLength === 3) return '### **RESPONSE LENGTH**\nWrite a longer, richly detailed response — aim for 4 to 6 paragraphs.'
  if (responseLength === 4) return '### **RESPONSE LENGTH**\nWrite a very long, deeply detailed response — aim for 6 or more paragraphs.'
  return null
}

function buildNarrativeStyleInstruction(narrativeStyle: number | null | undefined): string | null {
  if (narrativeStyle === 0) return '### **STYLE BALANCE**\nWrite entirely in dialogue. Use no narrative description or action prose whatsoever — only spoken words.'
  if (narrativeStyle === 1) return '### **STYLE BALANCE**\nFocus heavily on dialogue and spoken exchange. Keep action lines and descriptive prose brief and minimal.'
  if (narrativeStyle === 3) return '### **STYLE BALANCE**\nFocus heavily on narrative description, action, and atmosphere. Use spoken dialogue sparingly.'
  if (narrativeStyle === 4) return '### **STYLE BALANCE**\nWrite entirely in narrative prose — atmospheric description, internal thoughts, and action. Use no spoken dialogue at all.'
  return null
}

function buildSourceMaterialBlock(botInfo: BotInfo): string[] {
  const parts: string[] = []

  if (botInfo.character_quotes && botInfo.character_quotes.length > 0) {
    const quotesText = botInfo.character_quotes.map((q) => `"${q}"`).join('\n')
    parts.push(`### **ICONIC QUOTES — YOUR EXACT VOICE**\n${quotesText}`)
  }

  if (botInfo.source_excerpts && botInfo.source_excerpts.trim()) {
    parts.push(`### **SOURCE MATERIAL — CANON REFERENCE**\n${botInfo.source_excerpts.trim()}`)
  }

  if (botInfo.example_dialogues && botInfo.example_dialogues.length > 0) {
    const dialogueLines = botInfo.example_dialogues
      .filter((d) => d.user?.trim() && d.bot?.trim())
      .map((d) => `User: ${d.user.trim()}\n${botInfo.name}: ${d.bot.trim()}`)
      .join('\n\n')
    if (dialogueLines) {
      parts.push(`### **EXAMPLE CONVERSATIONS — HOW YOU RESPOND**\n${dialogueLines}`)
    }
  }

  return parts
}

function scoreLabel(s: number): string {
  if (s <= -76) return 'Archrivals'
  if (s <= -51) return 'Bitter Enemies'
  if (s <= -26) return 'Rivals'
  if (s <= -11) return 'Cold Strangers'
  if (s <= 10) return 'Neutral'
  if (s <= 25) return 'Acquaintances'
  if (s <= 50) return 'Friends'
  if (s <= 75) return 'Close Friends'
  if (s <= 90) return 'Deeply Bonded'
  if (s <= 99) return 'Devoted'
  return 'Lovers'
}

// POST /api/chats/[chatId]/opener
// Generates the bot's opening message and saves it to the chat.
// Body: { personaId?: string, scenario?: string, replaceMessageId?: string }
// - personaId: optional persona to use as context
// - scenario: optional scene-setting prompt from the user
// - replaceMessageId: if provided, deletes that message before generating a new one (for regeneration)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { serviceClient } = getSupabaseClients()
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chatId } = await params
    const body = await req.json()
    const personaId =
      typeof body.personaId === 'string' && body.personaId.trim() ? body.personaId.trim() : null
    const scenario =
      typeof body.scenario === 'string' && body.scenario.trim() ? body.scenario.trim() : null
    const replaceMessageId =
      typeof body.replaceMessageId === 'string' && body.replaceMessageId.trim()
        ? body.replaceMessageId.trim()
        : null

    // Verify ownership and load chat + bot info
    const [{ data: chat, error: chatError }, { data: userProfile }] = await Promise.all([
      serviceClient
        .from('chats')
        .select(
          'id, user_id, bot_id, persona_id, is_nsfw, api_temperature, response_length, narrative_style, chat_tone, bots(personality, name, source_excerpts, example_dialogues, character_quotes, default_tone), personas(name, description)'
        )
        .eq('id', chatId)
        .single(),
      serviceClient.from('users').select('hard_boundaries').eq('id', user.id).maybeSingle(),
    ])

    if (chatError || !chat || chat.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

    const typedChat = chat as unknown as ChatWithRelations
    const botInfo = firstRelation(typedChat.bots)
    if (!botInfo) {
      return NextResponse.json({ error: 'Bot details missing for chat' }, { status: 500 })
    }

    const hardBoundaries =
      (userProfile as { hard_boundaries?: string[] } | null)?.hard_boundaries ?? []

    // Resolve persona context
    let personaContext: PersonaContext | null = firstRelation(typedChat.personas)
    if (personaId) {
      const { data: persona, error: personaError } = await serviceClient
        .from('personas')
        .select('id, name, description')
        .eq('id', personaId)
        .eq('user_id', user.id)
        .single()
      if (personaError || !persona) {
        return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
      }
      personaContext = { name: persona.name, description: persona.description }
    }

    // Build persona prompt
    const personaPrompt = personaContext
      ? `The user is roleplaying as ${personaContext.name}.${personaContext.description ? ` Persona details: ${personaContext.description}` : ''}`
      : 'The user is chatting as themselves.'

    // Look up relationship data
    let relationshipBlock: string | null = null
    if (personaContext && personaId) {
      const { data: rel } = await serviceClient
        .from('chat_persona_relationships')
        .select(
          'relationship_context, relationship_score, relationship_tags, relationship_events, relationship_summary'
        )
        .eq('chat_id', chatId)
        .eq('persona_id', personaId)
        .maybeSingle()

      if (rel) {
        const pName = personaContext.name
        const score = (rel.relationship_score as number | null) ?? 0
        const tags = (rel.relationship_tags as string[] | null) ?? []
        const events = (rel.relationship_events as RelationshipEvent[] | null) ?? []
        const backstory = (rel.relationship_context as string | null)?.trim()
        const summary = (rel.relationship_summary as string | null)?.trim()

        const hasAnyRelationshipInfo =
          backstory || summary || tags.length > 0 || events.length > 0 || score !== 0
        if (hasAnyRelationshipInfo) {
          const lines: string[] = [
            `### **YOUR RELATIONSHIP WITH ${pName.toUpperCase()}**`,
            `Current stage: **${scoreLabel(score)}** (${score > 0 ? '+' : ''}${score}/100)`,
          ]
          if (tags.length > 0) lines.push(`Relationship tags: ${tags.join(', ')}`)
          if (summary) {
            lines.push(`\nRelationship dynamic:\n${summary}`)
          } else if (backstory) {
            lines.push(`\nContext:\n${backstory}`)
          }
          if (events.length > 0) {
            const eventLines = events
              .slice(-8)
              .map((e) => `- ${e.date}: ${e.description}`)
              .join('\n')
            lines.push(`\nKey shared memories:\n${eventLines}`)
          }
          lines.push(
            `\nThis is the emotional truth between you and ${pName}. Do NOT state it plainly — embody it. Let it bleed through every glance, every pause, every word chosen or bitten back.`
          )
          relationshipBlock = lines.join('\n')
        }
      }
    }

    const hardBoundariesGuardrail = buildHardBoundariesGuardrail(hardBoundaries)

    const systemPrompt = [
      `You are ${botInfo.name}. ${botInfo.personality}`,
      personaPrompt,
      ...(relationshipBlock ? [relationshipBlock] : []),
      buildContentRatingInstruction(typedChat.is_nsfw ?? false),
      ...(hardBoundariesGuardrail ? [hardBoundariesGuardrail] : []),
      FOURTH_WALL_MUSIC_GUARDRAIL,
      `### **CRITICAL ROLEPLAY RULES**`,
      `- ALWAYS stay in character as ${botInfo.name}.`,
      `- NEVER write dialogue, actions, or thoughts for ${personaContext?.name || 'the user'}.`,
      `- Drive the narrative forward but leave room for the user to respond.`,
      ROLEPLAY_FORMATTING_INSTRUCTIONS,
      ...(typedChat.is_nsfw ? [NSFW_ROLEPLAY_RULES] : []),
      ...(buildResponseLengthInstruction(typedChat.response_length)
        ? [buildResponseLengthInstruction(typedChat.response_length)!]
        : []),
      ...(buildNarrativeStyleInstruction(typedChat.narrative_style)
        ? [buildNarrativeStyleInstruction(typedChat.narrative_style)!]
        : []),
      ...(buildToneInstruction(typedChat.chat_tone ?? botInfo.default_tone)
        ? [buildToneInstruction(typedChat.chat_tone ?? botInfo.default_tone)!]
        : []),
      ...buildSourceMaterialBlock(botInfo),
    ].join('\n\n')

    // The user message to the AI asks the bot to open the scene
    const openerUserMessage = scenario
      ? `[Scene setup: ${scenario}]\n\nPlease write your opening message to begin this scene.`
      : `Please write your opening message to begin this roleplay.`

    const openrouterApiKey = resolveOpenRouterApiKey()
    const openrouterModel = resolveOpenRouterModel('openrouter/auto')
    const chatTemperature =
      typeof typedChat.api_temperature === 'number' ? typedChat.api_temperature : 0.92

    let botResponseContent: string | null = null
    let failureReason: string | null = null

    if (!openrouterApiKey) {
      failureReason = 'OPENROUTER_API_KEY is not configured on the server'
    } else {
      // Primary model
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
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: openerUserMessage },
            ],
            model: openrouterModel,
            temperature: chatTemperature,
            frequency_penalty: 0.4,
            presence_penalty: 0.5,
          }),
        })

        const data: OpenRouterResponse | null = await openrouterResp.json().catch(() => null)
        if (openrouterResp.ok) {
          botResponseContent = data?.choices?.[0]?.message?.content?.trim() || null
          if (!botResponseContent) failureReason = 'OpenRouter returned an empty response'
        } else {
          failureReason = getOpenRouterErrorMessage(
            data,
            `OpenRouter returned status ${openrouterResp.status}`
          )
        }
      } catch (err) {
        failureReason = getErrorMessage(err, 'OpenRouter request failed')
      }

      // Fallback model
      if (!botResponseContent) {
        const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4-turbo'
        try {
          const fallbackResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openrouterApiKey}`,
              'HTTP-Referer': resolveOpenRouterReferer(),
              'X-Title': 'Botainy',
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: openerUserMessage },
              ],
              model: fallbackModel,
              temperature: chatTemperature,
              frequency_penalty: 0.4,
              presence_penalty: 0.5,
            }),
          })
          const fallbackData: OpenRouterResponse | null = await fallbackResp.json().catch(() => null)
          if (fallbackResp.ok) {
            botResponseContent = fallbackData?.choices?.[0]?.message?.content?.trim() || null
            if (botResponseContent) failureReason = null
          }
        } catch {
          // swallow fallback error
        }
      }
    }

    if (!botResponseContent) {
      return NextResponse.json(
        { error: failureReason || 'Bot opening message could not be generated' },
        { status: 500 }
      )
    }

    // Delete the previous opener message if regenerating
    if (replaceMessageId) {
      await serviceClient
        .from('chat_messages')
        .delete()
        .eq('id', replaceMessageId)
        .eq('chat_id', chatId)
    }

    // Save bot's opening message
    const candidateSenderIds = [`bot_${chat.bot_id}`, chat.bot_id]
    let savedMessage: Record<string, unknown> | null = null

    for (const senderId of candidateSenderIds) {
      const { data, error } = await serviceClient
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          content: botResponseContent,
        })
        .select()
        .single()

      if (!error && data) {
        savedMessage = data
        break
      }

      // Only retry if it's a sender_id constraint issue
      const msg = getErrorMessage(error, '').toLowerCase()
      if (
        !msg.includes('sender_id') ||
        (!msg.includes('invalid input syntax for type uuid') &&
          !msg.includes('violates foreign key constraint') &&
          !msg.includes('is not present in table'))
      ) {
        break
      }
    }

    if (!savedMessage) {
      return NextResponse.json(
        { error: 'Opening message was generated but could not be saved' },
        { status: 500 }
      )
    }

    // Update chat timestamp
    await serviceClient
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)

    return NextResponse.json({ message: savedMessage })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
