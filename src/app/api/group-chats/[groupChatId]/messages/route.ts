import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getOpenRouterErrorMessage,
  resolveOpenRouterApiKey,
  resolveOpenRouterModel,
  resolveOpenRouterReferer,
} from '@/lib/openrouterServer'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type GroupChatContext = {
  id: string
  name: string
  creator_id: string
  group_type: 'general' | 'roleplay' | 'ttrpg'
  rules: string | null
  universe: string | null
  dm_mode: 'user' | 'bot' | null
  dm_bot_id: string | null
}

type GroupBot = {
  id: string
  name: string
  personality: string
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string } | string | unknown
  message?: unknown
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
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

function pickRespondingBot(group: GroupChatContext, bots: GroupBot[], userMessageId: string) {
  if (bots.length === 0) return null

  if (group.group_type === 'ttrpg' && group.dm_mode === 'bot' && group.dm_bot_id) {
    const dmBot = bots.find((bot) => bot.id === group.dm_bot_id)
    if (dmBot) return dmBot
  }

  const numericSeed = userMessageId
    .replace(/-/g, '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  return bots[numericSeed % bots.length]
}

function buildGroupModePrompt(group: GroupChatContext) {
  if (group.group_type === 'ttrpg') {
    return [
      'This is a TTRPG-style group chat.',
      group.rules ? `Table rules: ${group.rules}` : null,
      group.universe ? `Campaign setting: ${group.universe}` : null,
      'Keep replies immersive, scene-aware, and concise.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (group.group_type === 'roleplay') {
    return [
      'This is a roleplay group chat.',
      group.universe ? `Universe: ${group.universe}` : null,
      group.rules ? `Roleplay rules: ${group.rules}` : null,
      'Stay in-character and respond naturally to the latest turn.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    'This is a casual group chat with users and bots.',
    'Keep your response short and conversational unless asked for detail.',
  ].join('\n')
}

async function generateBotReply({
  group,
  bot,
  recentMessages,
  requestingUserId,
}: {
  group: GroupChatContext
  bot: GroupBot
  recentMessages: Array<{ sender_id: string; content: string }>
  requestingUserId: string
}) {
  const openrouterApiKey = resolveOpenRouterApiKey()
  if (!openrouterApiKey) {
    return { content: null, warning: 'OPENROUTER_API_KEY is not configured on the server' }
  }

  const model = resolveOpenRouterModel('openrouter/auto')

  const systemPrompt = [
    `You are ${bot.name}.`,
    bot.personality,
    buildGroupModePrompt(group),
    'Only produce your own in-character message. Do not narrate other participants.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const messageHistory = recentMessages.map((message) => ({
    role: message.sender_id === requestingUserId ? 'user' : 'assistant',
    content: message.content,
  }))

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
      }),
    })

    const payload: OpenRouterResponse | null = await openrouterResp.json().catch(() => null)
    if (!openrouterResp.ok) {
      return {
        content: null,
        warning: getOpenRouterErrorMessage(
          payload,
          `OpenRouter returned status ${openrouterResp.status}`
        ),
      }
    }

    return {
      content: payload?.choices?.[0]?.message?.content?.trim() || null,
      warning: null,
    }
  } catch (error: unknown) {
    return {
      content: null,
      warning: getErrorMessage(error, 'OpenRouter request failed'),
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
    const { error } = await svc.from('group_chat_messages').insert({
      group_chat_id: groupChatId,
      sender_id: senderId,
      content,
    })

    if (!error) return null
    if (!isLikelySenderIdConstraintError(error)) {
      return getErrorMessage(error, 'Failed to persist bot response')
    }
  }

  // Backward-compatible fallback for databases where sender_id is still UUID-constrained.
  const { error: fallbackError } = await svc.from('group_chat_messages').insert({
    group_chat_id: groupChatId,
    sender_id: fallbackHumanSenderId,
    content: `[${bot.name}] ${content}`,
  })

  return fallbackError ? getErrorMessage(fallbackError, 'Failed to persist bot response') : null
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

    const { data, error } = await serviceClient()
      .from('group_chat_messages')
      .select('id, group_chat_id, sender_id, content, created_at, updated_at')
      .eq('group_chat_id', groupChatId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data || [])
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

    const svc = serviceClient()
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

    // Bot responses are best-effort; user message delivery should still succeed even if bots fail.
    try {
      const { data: groupRow } = await svc
        .from('group_chats')
        .select('id, name, creator_id, group_type, rules, universe, dm_mode, dm_bot_id')
        .eq('id', groupChatId)
        .maybeSingle()

      const group = groupRow as GroupChatContext | null

      if (group) {
        const { data: botRows } = await svc
          .from('group_chat_bots')
          .select('bot_id, bots(id, name, personality)')
          .eq('group_chat_id', groupChatId)

        const bots: GroupBot[] = (botRows || [])
          .map((row) => firstRelation((row as { bots?: GroupBot | GroupBot[] | null }).bots))
          .filter((bot): bot is GroupBot => Boolean(bot?.id && bot?.name))

        const respondingBot = pickRespondingBot(group, bots, data.id)

        if (respondingBot) {
          const { data: recentMessages } = await svc
            .from('group_chat_messages')
            .select('sender_id, content')
            .eq('group_chat_id', groupChatId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .limit(20)

          const botReply = await generateBotReply({
            group,
            bot: respondingBot,
            recentMessages: recentMessages || [],
            requestingUserId: user.id,
          })

          if (botReply.warning) {
            console.error('Group chat bot generation warning:', botReply.warning)
          }

          if (botReply.content) {
            const persistError = await persistBotMessage({
              groupChatId,
              bot: respondingBot,
              content: botReply.content,
              fallbackHumanSenderId: group.creator_id,
            })

            if (persistError) {
              console.error('Group chat bot persist warning:', persistError)
            }
          }
        }
      }
    } catch (botError: unknown) {
      console.error('Failed to generate group chat bot response:', getErrorMessage(botError))
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
