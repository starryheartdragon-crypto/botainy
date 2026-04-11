import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenRouterErrorMessage, resolveOpenRouterApiKey, resolveOpenRouterModel, resolveOpenRouterReferer } from '@/lib/openrouterServer'
import { buildContentRatingInstruction, buildHardBoundariesGuardrail, FOURTH_WALL_MUSIC_GUARDRAIL, NSFW_ROLEPLAY_RULES, ROLEPLAY_FORMATTING_INSTRUCTIONS } from '@/lib/roleplayFormatting'

type PersonaContext = { name: string; description: string | null }
type BotInfo = { name: string; personality: string; source_excerpts: string | null; example_dialogues: Array<{ user: string; bot: string }> | null; character_quotes: string[] | null }
type RelationshipEvent = { id: string; date: string; description: string }
type ChatWithRelations = {
  id: string
  user_id: string
  bot_id: string
  is_nsfw: boolean | null
  relationship_context: string | null
  relationship_score: number | null
  relationship_tags: string[] | null
  relationship_events: RelationshipEvent[] | null
  relationship_summary: string | null
  api_temperature: number | null
  response_length: number | null
  narrative_style: number | null
  bots: BotInfo | BotInfo[] | null
  personas: PersonaContext | PersonaContext[] | null
}
type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string } | string | unknown
  message?: unknown
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

async function getAuthUser(req: NextRequest) {
  const { authClient } = getSupabaseClients()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) return null
  return user
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function buildResponseLengthInstruction(responseLength: number | null | undefined): string | null {
  if (responseLength === 0) return '### **RESPONSE LENGTH**\nKeep your response very short — 1 paragraph at most. Be terse and to the point.'
  if (responseLength === 1) return '### **RESPONSE LENGTH**\nKeep your response short and concise — aim for 1 to 2 paragraphs.'
  if (responseLength === 3) return '### **RESPONSE LENGTH**\nWrite a longer, richly detailed response — aim for 4 to 6 paragraphs.'
  if (responseLength === 4) return '### **RESPONSE LENGTH**\nWrite a very long, deeply detailed response — aim for 6 or more paragraphs with rich description and depth.'
  return null
}

function buildNarrativeStyleInstruction(narrativeStyle: number | null | undefined): string | null {
  if (narrativeStyle === 0) return '### **STYLE BALANCE**\nWrite entirely in dialogue. Use no narrative description or action prose whatsoever — only spoken words.'
  if (narrativeStyle === 1) return '### **STYLE BALANCE**\nFocus heavily on dialogue and spoken exchange. Keep action lines and descriptive prose brief and minimal.'
  if (narrativeStyle === 3) return '### **STYLE BALANCE**\nFocus heavily on narrative description, action, and atmosphere. Use spoken dialogue sparingly — let the scene do the talking.'
  if (narrativeStyle === 4) return '### **STYLE BALANCE**\nWrite entirely in narrative prose — atmospheric description, internal thoughts, and action. Use no spoken dialogue at all.'
  return null
}

function buildSourceMaterialBlock(botInfo: BotInfo): string[] {
  const parts: string[] = []

  if (botInfo.character_quotes && botInfo.character_quotes.length > 0) {
    const quotesText = botInfo.character_quotes.map((q) => `"${q}"`).join('\n')
    parts.push(`### **ICONIC QUOTES — YOUR EXACT VOICE**\nThese are real lines from your canon. Study the rhythm, vocabulary, and tone. This is how you sound:\n${quotesText}`)
  }

  if (botInfo.source_excerpts && botInfo.source_excerpts.trim()) {
    parts.push(`### **SOURCE MATERIAL — CANON REFERENCE**\nThe following is authentic material from the source canon. Use it to anchor your voice, mannerisms, and worldview:\n${botInfo.source_excerpts.trim()}`)
  }

  if (botInfo.example_dialogues && botInfo.example_dialogues.length > 0) {
    const dialogueLines = botInfo.example_dialogues
      .filter((d) => d.user?.trim() && d.bot?.trim())
      .map((d) => `User: ${d.user.trim()}\n${botInfo.name}: ${d.bot.trim()}`)
      .join('\n\n')
    if (dialogueLines) {
      parts.push(`### **EXAMPLE CONVERSATIONS — HOW YOU RESPOND**\nThese demonstrate exactly how you engage. Match this tone and style:\n${dialogueLines}`)
    }
  }

  return parts
}

// GET /api/chats/[chatId]/messages - Get messages for a chat
export async function GET(
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

    // Verify user owns this chat
    const { data: chat, error: chatError } = await serviceClient
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .single()

    if (chatError || !chat || chat.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

    // Get messages
    const { data: messages, error } = await serviceClient
      .from('chat_messages')
      .select('id, chat_id, sender_id, content, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: getErrorMessage(error, 'Failed to load chat messages') }, { status: 500 })
    }

    return NextResponse.json(messages)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/chats/[chatId]/messages - Send a message and get bot response
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

    const body = await req.json()
    const { content } = body
    const hasPersonaId = Object.prototype.hasOwnProperty.call(body, 'personaId')
    const personaId = typeof body.personaId === 'string' && body.personaId.trim()
      ? body.personaId.trim()
      : null
    const { chatId } = await params

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }

    // Verify user owns this chat and get bot personality
    const [{ data: chat, error: chatError }, { data: userProfile }] = await Promise.all([
      serviceClient
        .from('chats')
        .select('id, user_id, bot_id, persona_id, is_nsfw, relationship_context, relationship_score, relationship_tags, relationship_events, relationship_summary, api_temperature, response_length, narrative_style, bots(personality, name, source_excerpts, example_dialogues, character_quotes), personas(name, description)')
        .eq('id', chatId)
        .single(),
      serviceClient
        .from('users')
        .select('hard_boundaries')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (chatError || !chat || chat.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

    const hardBoundaries = (userProfile as { hard_boundaries?: string[] } | null)?.hard_boundaries ?? []

    const typedChat = chat as unknown as ChatWithRelations
    let personaContext: PersonaContext | null = firstRelation(typedChat.personas)
    if (hasPersonaId) {
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

        personaContext = {
          name: persona.name,
          description: persona.description,
        }
      } else {
        personaContext = null
      }

      await serviceClient
        .from('chats')
        .update({ persona_id: personaId })
        .eq('id', chatId)
        .eq('user_id', user.id)
    }

    // Save user message
    const { data: userMessage, error: userMsgError } = await serviceClient
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content: content.trim(),
      })
      .select()
      .single()

    if (userMsgError) {
      return NextResponse.json(
        { error: getErrorMessage(userMsgError, 'Failed to save user message') },
        { status: 500 }
      )
    }

    // Get recent messages for context (last 10)
    const { data: recentMessages } = await serviceClient
      .from('chat_messages')
      .select('sender_id, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(30)

    // Build message history for OpenRouter
    const messageHistory = (recentMessages || []).map((msg) => ({
      role: msg.sender_id === user.id ? 'user' : 'assistant',
      content: msg.content,
    }))

    // Add system prompt with bot personality
    const botInfo = firstRelation(typedChat.bots)
    if (!botInfo) {
      return NextResponse.json({ error: 'Bot details missing for chat' }, { status: 500 })
    }
    const personaPrompt = personaContext
      ? `The user is roleplaying as ${personaContext.name}.${personaContext.description ? ` Persona details: ${personaContext.description}` : ''}`
      : 'The user is chatting as themselves.'

    const relationshipBlock = (() => {
      if (!personaContext) return null
      const pName = personaContext.name

      const score = typedChat.relationship_score ?? 0
      const tags = typedChat.relationship_tags ?? []
      const events = typedChat.relationship_events ?? []
      const backstory = typedChat.relationship_context?.trim()
      const summary = typedChat.relationship_summary?.trim()

      // Determine stage label
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

      const hasAnyRelationshipInfo = backstory || summary || tags.length > 0 || events.length > 0 || score !== 0
      if (!hasAnyRelationshipInfo) return null

      const lines: string[] = [
        `### **YOUR RELATIONSHIP WITH ${pName.toUpperCase()}**`,
        `Current stage: **${scoreLabel(score)}** (${score > 0 ? '+' : ''}${score}/100)`,
      ]

      if (tags.length > 0) {
        lines.push(`Relationship tags: ${tags.join(', ')}`)
      }
      if (summary) {
        lines.push(`\nRelationship dynamic:\n${summary}`)
      } else if (backstory) {
        lines.push(`\nContext:\n${backstory}`)
      }
      if (events.length > 0) {
        const eventLines = events.slice(-8).map((e) => `- ${e.date}: ${e.description}`).join('\n')
        lines.push(`\nKey shared memories:\n${eventLines}`)
      }
      lines.push(`\nThis is the emotional truth between you and ${pName}. Do NOT state it plainly — embody it. Let it bleed through every glance, every pause, every word chosen or bitten back.`)

      return lines.join('\n')
    })()

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
      ...(buildResponseLengthInstruction(typedChat.response_length) ? [buildResponseLengthInstruction(typedChat.response_length)!] : []),
      ...(buildNarrativeStyleInstruction(typedChat.narrative_style) ? [buildNarrativeStyleInstruction(typedChat.narrative_style)!] : []),
      ...buildSourceMaterialBlock(botInfo),
    ].join('\n\n')
    const openrouterApiKey = resolveOpenRouterApiKey()
    const openrouterModel = resolveOpenRouterModel('openrouter/auto')
    const chatTemperature = typeof typedChat.api_temperature === 'number' ? typedChat.api_temperature : 0.92
    let botResponseContent: string | null = null
    let openrouterFailureReason: string | null = null
    let openrouterFailureStatus: number | null = null

    if (!openrouterApiKey) {
      openrouterFailureReason = 'OPENROUTER_API_KEY is not configured on the server'
      console.error(openrouterFailureReason)
    } else {
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
              ...messageHistory,
            ],
            model: openrouterModel,
            temperature: chatTemperature,          // Per-chat temperature from settings
            frequency_penalty: 0.4,     // Penalizes the bot for using the exact same words repeatedly
            presence_penalty: 0.5,      // Encourages new concepts, feelings, and actions each turn
          }),
        })

        const openrouterData: OpenRouterResponse | null = await openrouterResp
          .json()
          .catch(() => null)

        if (openrouterResp.ok) {
          botResponseContent = openrouterData?.choices?.[0]?.message?.content?.trim() || null
          if (!botResponseContent) {
            openrouterFailureReason = 'OpenRouter returned an empty response'
            openrouterFailureStatus = openrouterResp.status
          }
        } else {
          openrouterFailureStatus = openrouterResp.status
          openrouterFailureReason = getOpenRouterErrorMessage(
            openrouterData,
            `OpenRouter returned status ${openrouterResp.status}`
          )

          console.error('OpenRouter returned non-OK response:', {
            status: openrouterResp.status,
            error: openrouterFailureReason,
            model: openrouterModel,
          })
        }
      } catch (openrouterError) {
        openrouterFailureReason = getErrorMessage(openrouterError, 'OpenRouter request failed')
        console.error('OpenRouter request failed:', openrouterFailureReason)
      }

      // Fallback to OPENROUTER_FALLBACK_MODEL if primary model failed
      if (!botResponseContent) {
        const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4-turbo'
        console.warn(`Primary model (${openrouterModel}) failed, retrying with fallback (${fallbackModel})`)
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
                ...messageHistory,
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
            if (botResponseContent) {
              openrouterFailureReason = null
              openrouterFailureStatus = null
            }
          }
        } catch (fallbackError) {
          console.error('Fallback model also failed:', fallbackError)
        }
      }
    }

    if (!botResponseContent) {
      await serviceClient
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId)

      return NextResponse.json({
        userMessage,
        botMessage: null,
        warning:
          openrouterFailureStatus !== null
            ? `[OpenRouter ${openrouterFailureStatus}] ${openrouterFailureReason || 'Bot response could not be generated'} (model: ${openrouterModel})`
            : `${openrouterFailureReason || 'Bot response could not be generated'} (model: ${openrouterModel})`,
      })
    }

    // Save bot response
    const candidateSenderIds = [`bot_${chat.bot_id}`, chat.bot_id]
    let botMessage: Record<string, unknown> | null = null
    let lastBotInsertError: unknown = null

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
        botMessage = data
        lastBotInsertError = null
        break
      }

      lastBotInsertError = error
      if (!isLikelySenderIdConstraintError(error)) {
        break
      }
    }

    if (!botMessage) {
      console.error('Failed to persist bot response:', getErrorMessage(lastBotInsertError, 'Unknown error'))

      await serviceClient
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId)

      return NextResponse.json({
        userMessage,
        botMessage: null,
        warning: 'Bot response could not be persisted',
      })
    }

    // Update chat timestamp
    await serviceClient
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)

    return NextResponse.json({
      userMessage,
      botMessage,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
