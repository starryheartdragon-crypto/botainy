import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

function getAnonClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
  return createClient(url, key)
}

async function requireAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const { data: { user }, error } = await getAnonClient().auth.getUser(token)
  return (!error && user) ? user : null
}

// POST /api/users/[username]/like — toggle profile like
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const viewer = await requireAuth(req)
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = await params
  const service = getServiceClient()

  const { data: target } = await service.from('users').select('id').eq('username', username).maybeSingle()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.id === viewer.id) return NextResponse.json({ error: 'Cannot like your own profile' }, { status: 400 })

  // Toggle
  const { data: existing } = await service
    .from('profile_likes')
    .select('id')
    .eq('user_id', viewer.id)
    .eq('profile_user_id', target.id)
    .maybeSingle()

  if (existing) {
    await service.from('profile_likes').delete().eq('user_id', viewer.id).eq('profile_user_id', target.id)
    const { count } = await service.from('profile_likes').select('id', { count: 'exact', head: true }).eq('profile_user_id', target.id)
    return NextResponse.json({ liked: false, likes_count: count ?? 0 })
  } else {
    const { error } = await service.from('profile_likes').insert({ user_id: viewer.id, profile_user_id: target.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { count } = await service.from('profile_likes').select('id', { count: 'exact', head: true }).eq('profile_user_id', target.id)
    return NextResponse.json({ liked: true, likes_count: count ?? 0 })
  }
}
