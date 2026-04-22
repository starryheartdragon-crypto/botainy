/**
 * GET /api/badges
 * Returns all active badges (optionally filtered by category).
 *
 * POST /api/badges
 * Admin only: create a new badge.
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const includeInactive = url.searchParams.get('includeInactive') === 'true'

  let query = serviceClient()
    .from('badges')
    .select('*, badge_events(id, name, starts_at, ends_at)')
    .order('category')
    .order('name')

  if (!includeInactive) query = query.eq('is_active', true)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { slug, name, description, category, iconUrl, isEvent, eventId, reputationPoints } = body

  if (!slug || !name || !description || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('badges')
    .insert({
      slug,
      name,
      description,
      category,
      icon_url: iconUrl ?? null,
      is_event: isEvent ?? false,
      event_id: eventId ?? null,
      reputation_points: reputationPoints ?? 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
