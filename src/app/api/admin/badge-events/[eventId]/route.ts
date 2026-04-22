/**
 * PATCH /api/admin/badge-events/[eventId]
 * Update a badge event (admin only).
 *
 * DELETE /api/admin/badge-events/[eventId]
 * Delete a badge event (admin only). Unlinks associated badges (sets event_id = null).
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

async function isAdmin(userId: string) {
  const { data } = await serviceClient()
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  return data?.is_admin === true
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { eventId } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined)        updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.startsAt !== undefined)    updates.starts_at = body.startsAt
  if (body.endsAt !== undefined)      updates.ends_at = body.endsAt
  if (body.isActive !== undefined)    updates.is_active = body.isActive

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (updates.starts_at && updates.ends_at && new Date(updates.starts_at as string) >= new Date(updates.ends_at as string)) {
    return NextResponse.json({ error: 'startsAt must be before endsAt' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('badge_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { eventId } = await params
  const db = serviceClient()

  // Unlink associated badges before deleting (FK uses ON DELETE SET NULL, but let's be explicit)
  await db.from('badges').update({ event_id: null, is_event: false }).eq('event_id', eventId)

  const { error } = await db.from('badge_events').delete().eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
