import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
const ACTIVE_WINDOW_MINUTES = 10
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null
  return UUID_REGEX.test(trimmed) ? trimmed : null
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomId: rawRoomId } = await params
    const roomId = normalizeRoomId(rawRoomId)
    if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })

    const { data: memberCheck } = await serviceClient()
      .from('chat_room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: members, error } = await serviceClient()
      .from('chat_room_members')
      .select('user_id, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const userIds = (members || []).map((m) => m.user_id)

    if (userIds.length === 0) {
      return NextResponse.json([])
    }

    const { data: users, error: usersError } = await serviceClient()
      .from('users')
      .select('id, username, avatar_url')
      .in('id', userIds)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const userMap = new Map((users || []).map((u) => [u.id, u]))

    const { data: recentMessages, error: recentMessagesError } = await serviceClient()
      .from('chat_room_messages')
      .select('sender_id, created_at, persona_id, personas(name)')
      .eq('room_id', roomId)
      .in('sender_id', userIds)
      .order('created_at', { ascending: false })

    if (recentMessagesError) {
      return NextResponse.json({ error: recentMessagesError.message }, { status: 500 })
    }

    const latestByUser = new Map<string, {
      created_at: string
      persona_id: string | null
      persona_name: string | null
    }>()

    for (const message of recentMessages || []) {
      if (latestByUser.has(message.sender_id)) {
        continue
      }

      const personaRelation = message.personas as { name?: string | null } | { name?: string | null }[] | null
      const personaName = Array.isArray(personaRelation)
        ? (personaRelation[0]?.name ?? null)
        : (personaRelation?.name ?? null)

      latestByUser.set(message.sender_id, {
        created_at: message.created_at,
        persona_id: message.persona_id,
        persona_name: personaName,
      })
    }

    const activeThreshold = Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000

    const response = (members || []).map((m) => {
      const latest = latestByUser.get(m.user_id)
      const lastMessageAt = latest?.created_at || null
      const isActive = lastMessageAt ? new Date(lastMessageAt).getTime() >= activeThreshold : false

      return {
        user_id: m.user_id,
        joined_at: m.joined_at,
        username: userMap.get(m.user_id)?.username || null,
        avatar_url: userMap.get(m.user_id)?.avatar_url || null,
        persona_id: latest?.persona_id || null,
        persona_name: latest?.persona_name || null,
        last_message_at: lastMessageAt,
        is_active: isActive,
      }
    })

    return NextResponse.json(response)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
