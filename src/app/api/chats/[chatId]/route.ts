/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canUserAccessBot } from '@/lib/botVisibility'

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
      .select('id, user_id, bot_id, persona_id, is_nsfw, api_temperature, response_length, narrative_style, chat_tone, created_at, updated_at')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle()

    let chat: {
      id: string
      user_id: string
      bot_id: string
      persona_id?: string | null
      is_nsfw?: boolean
      api_temperature?: number | null
      response_length?: number | null
      narrative_style?: number | null
      chat_tone?: string | null
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
      .select('id, name, avatar_url, personality, creator_id, is_published')
      .eq('id', chat.bot_id)
      .maybeSingle()

    if (botError) {
      return NextResponse.json({ error: botError.message }, { status: 500 })
    }

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const canAccess = await canUserAccessBot(serviceClient, user.id, {
      id: bot.id,
      creator_id: bot.creator_id,
      is_published: bot.is_published,
    })

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { creator_id, is_published, ...safeBot } = bot

    return NextResponse.json({
      id: chat.id,
      bot_id: chat.bot_id,
      persona_id: chat.persona_id ?? null,
      is_nsfw: chat.is_nsfw ?? false,
      api_temperature: chat.api_temperature ?? 0.9,
      response_length: chat.response_length ?? 1,
      narrative_style: chat.narrative_style ?? 1,
      chat_tone: chat.chat_tone ?? null,
      bot: safeBot,
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

export async function PATCH(
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

    const body = await req.json()
    const { is_nsfw, api_temperature, response_length, narrative_style, chat_tone } = body

    const updates: Record<string, unknown> = {}

    if (typeof is_nsfw === 'boolean') {
      updates.is_nsfw = is_nsfw
    }
    if (Object.prototype.hasOwnProperty.call(body, 'api_temperature')) {
      if (typeof api_temperature !== 'number' || api_temperature < 0 || api_temperature > 2) {
        return NextResponse.json({ error: 'api_temperature must be a number between 0 and 2' }, { status: 400 })
      }
      updates.api_temperature = api_temperature
    }
    if (Object.prototype.hasOwnProperty.call(body, 'response_length')) {
      if (typeof response_length !== 'number' || ![0, 1, 2, 3, 4].includes(response_length)) {
        return NextResponse.json({ error: 'response_length must be 0, 1, 2, 3, or 4' }, { status: 400 })
      }
      updates.response_length = response_length
    }
    if (Object.prototype.hasOwnProperty.call(body, 'narrative_style')) {
      if (typeof narrative_style !== 'number' || ![0, 1, 2, 3, 4].includes(narrative_style)) {
        return NextResponse.json({ error: 'narrative_style must be 0, 1, 2, 3, or 4' }, { status: 400 })
      }
      updates.narrative_style = narrative_style
    }
    if (Object.prototype.hasOwnProperty.call(body, 'chat_tone')) {
      if (chat_tone !== null && (typeof chat_tone !== 'string' || chat_tone.trim().length > 200)) {
        return NextResponse.json({ error: 'chat_tone must be a string of up to 200 characters or null' }, { status: 400 })
      }
      updates.chat_tone = chat_tone === null ? null : chat_tone.trim() || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const { data: chat, error: chatError } = await serviceClient
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 })
    }

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { error: updateError } = await serviceClient
      .from('chats')
      .update(updates)
      .eq('id', chatId)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...updates })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

// Build message history for OpenRouter WITH Dialogue Tagging
// Move this logic inside the GET handler after bot is retrieved

// Example usage inside GET handler, after bot is defined:
/*
const botName = bot?.name ?? 'Bot';

// Define personaContext or set it to null if not available
const personaContext = null; // Replace with actual persona context if available

const userName = personaContext ? personaContext.name : 'User';

// Ensure recentMessages and user are defined in your context before using them
const messageHistory = (recentMessages || []).map((msg) => {
  const isUser = msg.sender_id === user.id;
  const speakerName = isUser ? userName : botName;
  
  return {
    role: isUser ? 'user' : 'assistant',
    content: `${speakerName}: ${msg.content}`,
  };
});
*/
