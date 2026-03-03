import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = createClient(supabaseUrl, serviceRoleKey)

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) return { user: null }

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) return { user: null }
  return { user }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const { user } = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await params

    const { data: chat, error: chatError } = await serviceClient
      .from('group_chats')
      .select('id, visibility, is_active, max_members')
      .eq('id', groupChatId)
      .single()

    if (chatError || !chat || !chat.is_active) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const { count: memberCount } = await serviceClient
      .from('group_chat_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_chat_id', groupChatId)

    if ((memberCount || 0) >= (chat.max_members || 50)) {
      return NextResponse.json({ error: 'Group is full' }, { status: 400 })
    }

    const { data: existing } = await serviceClient
      .from('group_chat_members')
      .select('id')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, alreadyJoined: true })
    }

    const { error: joinError } = await serviceClient
      .from('group_chat_members')
      .insert({
        group_chat_id: groupChatId,
        user_id: user.id,
      })

    if (joinError) {
      return NextResponse.json({ error: joinError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const { user } = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await params

    const { error } = await serviceClient
      .from('group_chat_members')
      .delete()
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
