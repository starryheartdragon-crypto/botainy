/**
 * GET /api/admin/badge-events
 * List all badge events (admin only).
 *
 * POST /api/admin/badge-events
 * Create a new badge event (admin only).
 * Body: { name, description?, startsAt, endsAt, isActive? }
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
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await serviceClient()
    .from('badge_events')
    .select('*, badges(id, slug, name)')
    .order('starts_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, description, startsAt, endsAt, isActive } = body

  if (!name || !startsAt || !endsAt) {
    return NextResponse.json({ error: 'name, startsAt and endsAt are required' }, { status: 400 })
  }

  if (new Date(startsAt) >= new Date(endsAt)) {
    return NextResponse.json({ error: 'startsAt must be before endsAt' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('badge_events')
    .insert({
      name,
      description: description ?? null,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
