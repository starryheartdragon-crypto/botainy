import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
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

  const { data: { user }, error } = await authClient().auth.getUser(token)
  if (error || !user) return null
  return user
}

async function isBannedUser(userId: string) {
  const { data, error } = await serviceClient()
    .from('users')
    .select('is_banned')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return !!data?.is_banned
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const banned = await isBannedUser(user.id)
    if (banned) {
      return NextResponse.json({ error: 'You are banned from chat rooms' }, { status: 403 })
    }

    const { roomId: rawRoomId } = await params
    const roomId = normalizeRoomId(rawRoomId)
    if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })

    const { data: room, error: roomError } = await serviceClient()
      .from('chat_rooms')
      .select('id')
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const { data: existing } = await serviceClient()
      .from('chat_room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, alreadyJoined: true })
    }

    const { error } = await serviceClient()
      .from('chat_room_members')
      .insert({ room_id: roomId, user_id: user.id })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomId: rawRoomId } = await params
    const roomId = normalizeRoomId(rawRoomId)
    if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
    const { error } = await serviceClient()
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
