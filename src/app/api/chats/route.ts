import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

function formatSupabaseError(error: {
  message?: string
  code?: string
  details?: string
  hint?: string
} | null | undefined) {
  if (!error) return 'Unknown database error'

  const parts = [error.message, error.details, error.hint].filter(
    (value): value is string => !!value && value.trim().length > 0
  )

  const body = parts.join(' | ') || 'Unknown database error'
  return error.code ? `[${error.code}] ${body}` : body
}

async function chatsTableSupportsPersona(
  serviceClient: ReturnType<typeof getSupabaseClients>['serviceClient']
) {
  const { error } = await serviceClient.from('chats').select('persona_id').limit(1)

  if (isMissingPersonaColumnError(error)) {
    return false
  }

  if (error) {
    throw new Error(error.message)
  }

  return true
}

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

// GET /api/chats - Get user's conversations with bots
export async function GET(req: NextRequest) {
  try {
    const { serviceClient } = getSupabaseClients()
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: chatsWithPersona, error: chatsError } = await serviceClient
      .from('chats')
      .select(`
        id,
        user_id,
        bot_id,
        persona_id,
        created_at,
        updated_at,
        bots!inner(id, name, avatar_url, personality),
        personas(id, name, avatar_url),
        chat_messages(id, created_at)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (!chatsError) {
      return NextResponse.json(chatsWithPersona)
    }

    if (!isMissingPersonaColumnError(chatsError)) {
      return NextResponse.json({ error: chatsError.message }, { status: 500 })
    }

    const { data: chatsWithoutPersona, error: fallbackError } = await serviceClient
      .from('chats')
      .select(`
        id,
        user_id,
        bot_id,
        created_at,
        updated_at,
        bots!inner(id, name, avatar_url, personality),
        chat_messages(id, created_at)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 })
    }

    const normalizedChats = (chatsWithoutPersona || []).map((chat: any) => ({
      ...chat,
      persona_id: null,
      personas: null,
    }))

    return NextResponse.json(normalizedChats)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/chats - Create a new chat with a bot
export async function POST(req: NextRequest) {
  try {
    const { serviceClient } = getSupabaseClients()
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { botId, personaId } = body
    const normalizedPersonaId =
      typeof personaId === 'string' && personaId.trim() ? personaId.trim() : null
    const personaSupported = await chatsTableSupportsPersona(serviceClient)
    const effectivePersonaId = personaSupported ? normalizedPersonaId : null

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID required' }, { status: 400 })
    }

    const { data: bot, error: botError } = await serviceClient
      .from('bots')
      .select('id')
      .eq('id', botId)
      .maybeSingle()

    if (botError) {
      return NextResponse.json({ error: botError.message }, { status: 500 })
    }

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (effectivePersonaId) {
      const { data: persona, error: personaError } = await serviceClient
        .from('personas')
        .select('id')
        .eq('id', effectivePersonaId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (personaError) {
        return NextResponse.json({ error: personaError.message }, { status: 500 })
      }

      if (!persona) {
        return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
      }
    }

    let existingQuery = serviceClient
      .from('chats')
      .select(personaSupported ? 'id, user_id, bot_id, persona_id, created_at, updated_at' : 'id, user_id, bot_id, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('bot_id', botId)

    if (effectivePersonaId) {
      existingQuery = existingQuery.eq('persona_id', effectivePersonaId)
    } else if (personaSupported) {
      existingQuery = existingQuery.is('persona_id', null)
    }

    const { data: existingChats, error: existingError } = await existingQuery
      .order('updated_at', { ascending: false })
      .limit(1)

    if (existingError) {
      return NextResponse.json({ error: formatSupabaseError(existingError) }, { status: 500 })
    }

    const existingChat = existingChats?.[0] ?? null

    if (existingChat) {
      return NextResponse.json(existingChat, { status: 200 })
    }

    // Create a new chat
    const insertPayload: Record<string, string | null> = {
      user_id: user.id,
      bot_id: botId,
    }

    if (personaSupported) {
      insertPayload.persona_id = effectivePersonaId
    }

    const { data: newChat, error: createError } = await serviceClient
      .from('chats')
      .insert(insertPayload)
      .select()
      .single()

    if (createError) {
      const duplicateConstraintError =
        createError.code === '23505' ||
        createError.message.toLowerCase().includes('duplicate key') ||
        createError.message.toLowerCase().includes('unique constraint')

      if (duplicateConstraintError) {
        let duplicateQuery = serviceClient
          .from('chats')
          .select(personaSupported ? 'id, user_id, bot_id, persona_id, created_at, updated_at' : 'id, user_id, bot_id, created_at, updated_at')
          .eq('user_id', user.id)
          .eq('bot_id', botId)

        if (effectivePersonaId) {
          duplicateQuery = duplicateQuery.eq('persona_id', effectivePersonaId)
        } else if (personaSupported) {
          duplicateQuery = duplicateQuery.is('persona_id', null)
        }

        const { data: duplicateChats, error: duplicateFetchError } = await duplicateQuery
          .order('updated_at', { ascending: false })
          .limit(1)

        if (duplicateFetchError) {
          return NextResponse.json({ error: formatSupabaseError(duplicateFetchError) }, { status: 500 })
        }

        const duplicateChat = duplicateChats?.[0] ?? null

        if (duplicateChat) {
          return NextResponse.json(duplicateChat, { status: 200 })
        }
      }

      return NextResponse.json({ error: formatSupabaseError(createError) }, { status: 500 })
    }

    return NextResponse.json(newChat, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
