/**
 * GET /api/badges/inventory
 * Returns the authenticated user's ungifted badge inventory.
 *
 * POST /api/badges/inventory/award
 * Internal: system auto-awards a badge to a user (called by trigger routes).
 * Body: { userId, badgeSlug }
 * This endpoint is protected by the service role key (CRON_SECRET header).
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
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('user_badge_inventory')
    .select('*, badge:badges(id, slug, name, description, category, icon_url, is_event, reputation_points, is_active)')
    .eq('user_id', user.id)
    .eq('gifted', false)
    .order('earned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
