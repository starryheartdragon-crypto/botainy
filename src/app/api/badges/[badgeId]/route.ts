/**
 * PATCH /api/badges/[badgeId]
 * Admin only: update a badge (name, description, isActive, reputationPoints, etc.)
 *
 * DELETE /api/badges/[badgeId]
 * Admin only: soft-retire a badge (sets is_active = false).
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
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { badgeId } = await params
  const body = await req.json()

  const allowed = ['name', 'description', 'category', 'icon_url', 'is_event', 'event_id', 'reputation_points', 'is_active']
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined)              updates.name = body.name
  if (body.description !== undefined)       updates.description = body.description
  if (body.category !== undefined)          updates.category = body.category
  if (body.iconUrl !== undefined)           updates.icon_url = body.iconUrl
  if (body.isEvent !== undefined)           updates.is_event = body.isEvent
  if (body.eventId !== undefined)           updates.event_id = body.eventId
  if (body.reputationPoints !== undefined)  updates.reputation_points = body.reputationPoints
  if (body.isActive !== undefined)          updates.is_active = body.isActive

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('badges')
    .update(updates)
    .eq('id', badgeId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { badgeId } = await params

  // Soft-retire: set is_active = false so existing received copies remain
  const { error } = await serviceClient()
    .from('badges')
    .update({ is_active: false })
    .eq('id', badgeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
