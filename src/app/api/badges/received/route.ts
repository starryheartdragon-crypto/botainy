/**
 * GET /api/badges/received
 * Returns received badges for the authenticated user (their own profile).
 *
 * GET /api/badges/received?userId=<id>
 * Returns received badges for any public profile (public view).
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
  const targetUserId = url.searchParams.get('userId')

  // If no userId param, require auth and return own badges
  let resolvedUserId = targetUserId
  if (!resolvedUserId) {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    resolvedUserId = user.id
  }

  const { data, error } = await serviceClient()
    .from('user_badges_received')
    .select(`
      id,
      recipient_id,
      gifter_id,
      badge_id,
      inventory_id,
      message,
      received_at,
      badge:badges(id, slug, name, description, category, icon_url, is_event, reputation_points, is_active),
      gifter:users!gifter_id(id, username, avatar_url)
    `)
    .eq('recipient_id', resolvedUserId)
    .order('received_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
