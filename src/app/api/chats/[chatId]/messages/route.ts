import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenRouterErrorMessage, resolveOpenRouterApiKey, resolveOpenRouterModel, resolveOpenRouterReferer } from '@/lib/openrouterServer'
import { ROLEPLAY_FORMATTING_INSTRUCTIONS } from '@/lib/roleplayFormatting'

type PersonaContext = { name: string; description: string | null }
type BotInfo = { name: string; personality: string }
type ChatWithRelations = {
  id: string
  user_id: string
  bot_id: string
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
    const { data: chat, error: chatError } = await serviceClient
      .from('chats')
      .select('id, user_id, bot_id, persona_id, bots(personality, name), personas(name, description)')
      .eq('id', chatId)
      .single()

    if (chatError || !chat || chat.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

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
    const systemPrompt = [
      `You are ${botInfo.name}. ${botInfo.personality}`,
      personaPrompt,
      `### **CRITICAL ROLEPLAY RULES**`,
      `- ALWAYS stay in character as ${botInfo.name}.`,
      `- NEVER write dialogue, actions, or thoughts for ${personaContext?.name || 'the user'}.`,
      `- Drive the narrative forward but leave room for the user to respond.`,
      ROLEPLAY_FORMATTING_INSTRUCTIONS,
    ].join('\n\n')
    const openrouterApiKey = resolveOpenRouterApiKey()
    const openrouterModel = resolveOpenRouterModel('openrouter/auto')
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
