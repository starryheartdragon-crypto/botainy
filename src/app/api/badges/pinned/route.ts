/**
 * GET /api/badges/pinned?userId=<id>
 * Returns up to 3 pinned badges for a user profile.
 *
 * PUT /api/badges/pinned
 * Authenticated: replace the caller's pinned badges.
 * Body: { pins: Array<{ receivedId: string; position: 1|2|3 }> }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7)
  if (!token) return null
  const { data: { user } } = await authClient().auth.getUser(token)
  return user ?? null
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const { data, error } = await serviceClient()
    .from('user_pinned_badges')
    .select(`
      user_id,
      received_id,
      position,
      received:user_badges_received(
        id,
        message,
        received_at,
        gifter_id,
        badge:badges(id, slug, name, description, category, icon_url, is_event, reputation_points),
        gifter:users!gifter_id(id, username, avatar_url)
      )
    `)
    .eq('user_id', userId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const pins: Array<{ receivedId: string; position: number }> = body.pins ?? []

  if (!Array.isArray(pins) || pins.length > 3) {
    return NextResponse.json({ error: 'pins must be an array of up to 3 items' }, { status: 400 })
  }

  const positions = pins.map((p) => p.position)
  if (positions.some((pos) => ![1, 2, 3].includes(pos))) {
    return NextResponse.json({ error: 'Position must be 1, 2, or 3' }, { status: 400 })
  }
  if (new Set(positions).size !== positions.length) {
    return NextResponse.json({ error: 'Duplicate positions' }, { status: 400 })
  }

  const db = serviceClient()

  // Verify all receivedIds belong to the authenticated user
  if (pins.length > 0) {
    const receivedIds = pins.map((p) => p.receivedId)
    const { data: existing } = await db
      .from('user_badges_received')
      .select('id')
      .eq('recipient_id', user.id)
      .in('id', receivedIds)

    if (!existing || existing.length !== receivedIds.length) {
      return NextResponse.json({ error: 'One or more received badge IDs are invalid' }, { status: 400 })
    }
  }

  // Replace all pins atomically: delete existing then insert new
  await db.from('user_pinned_badges').delete().eq('user_id', user.id)

  if (pins.length > 0) {
    const rows = pins.map((p) => ({
      user_id: user.id,
      received_id: p.receivedId,
      position: p.position,
    }))
    const { error: insertError } = await db.from('user_pinned_badges').insert(rows)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
