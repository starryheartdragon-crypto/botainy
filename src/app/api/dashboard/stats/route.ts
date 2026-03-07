import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

async function getUserFromAuthHeader(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return { user: null, error: 'Unauthorized' }
  }

  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Unauthorized' }
  }

  return { user, error: null }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [botsResult, chatsResult, personasResult, chatIdsResult] = await Promise.all([
      serviceClient().from('bots').select('*', { count: 'exact', head: true }).eq('creator_id', user.id),
      serviceClient().from('chats').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      serviceClient().from('personas').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      serviceClient().from('chats').select('id').eq('user_id', user.id),
    ])

    if (botsResult.error || chatsResult.error || personasResult.error || chatIdsResult.error) {
      const errorMessage =
        botsResult.error?.message ||
        chatsResult.error?.message ||
        personasResult.error?.message ||
        chatIdsResult.error?.message ||
        'Failed to load dashboard stats'

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    const chatIds = (chatIdsResult.data ?? []).map((row) => row.id)

    let messagesCount = 0
    if (chatIds.length > 0) {
      const { count, error: messagesError } = await serviceClient()
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('chat_id', chatIds)

      if (messagesError) {
        return NextResponse.json({ error: messagesError.message }, { status: 500 })
      }

      messagesCount = count ?? 0
    }

    return NextResponse.json({
      botsCreated: botsResult.count ?? 0,
      activeChats: chatsResult.count ?? 0,
      personas: personasResult.count ?? 0,
      messages: messagesCount,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load dashboard stats'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
