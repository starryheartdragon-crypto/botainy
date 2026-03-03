import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Server environment is missing required Supabase configuration')
  }

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey),
    serviceClient: createClient(supabaseUrl, serviceRoleKey),
  }
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

function isMissingPersonaColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase()
  return (
    message.includes('persona_id') &&
    (message.includes('column') ||
      message.includes('schema cache') ||
      error?.code === '42703' ||
      error?.code === 'PGRST204')
  )
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chatId } = await params
    const { serviceClient } = getSupabaseClients()

    const withPersonaQuery = await serviceClient
      .from('chats')
      .select('id, user_id, bot_id, persona_id, created_at, updated_at')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle()

    let chat: {
      id: string
      user_id: string
      bot_id: string
      persona_id?: string | null
      created_at?: string
      updated_at?: string
    } | null = null

    if (withPersonaQuery.error && !isMissingPersonaColumnError(withPersonaQuery.error)) {
      return NextResponse.json({ error: withPersonaQuery.error.message }, { status: 500 })
    }

    if (withPersonaQuery.error && isMissingPersonaColumnError(withPersonaQuery.error)) {
      const fallback = await serviceClient
        .from('chats')
        .select('id, user_id, bot_id, created_at, updated_at')
        .eq('id', chatId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }

      chat = fallback.data ? { ...fallback.data, persona_id: null } : null
    } else {
      chat = withPersonaQuery.data
    }

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { data: bot, error: botError } = await serviceClient
      .from('bots')
      .select('id, name, avatar_url, personality')
      .eq('id', chat.bot_id)
      .maybeSingle()

    if (botError) {
      return NextResponse.json({ error: botError.message }, { status: 500 })
    }

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: chat.id,
      bot_id: chat.bot_id,
      persona_id: chat.persona_id ?? null,
      bot,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chatId } = await params
    const { serviceClient } = getSupabaseClients()

    const { data: chat, error: chatError } = await serviceClient
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .maybeSingle()

    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 })
    }

    if (!chat || chat.user_id !== user.id) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { error: deleteMessagesError } = await serviceClient
      .from('chat_messages')
      .delete()
      .eq('chat_id', chatId)

    if (deleteMessagesError) {
      return NextResponse.json({ error: deleteMessagesError.message }, { status: 500 })
    }

    const { error: deleteChatError } = await serviceClient
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id)

    if (deleteChatError) {
      return NextResponse.json({ error: deleteChatError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
