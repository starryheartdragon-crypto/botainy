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

async function resolveTargetUserId(username: string): Promise<string | null> {
  const { data } = await getServiceClient().from('users').select('id').eq('username', username).maybeSingle()
  return data?.id ?? null
}

// POST /api/users/[username]/follow — toggle follow/unfollow
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const viewer = await requireAuth(req)
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username } = await params
  const service = getServiceClient()
  const targetId = await resolveTargetUserId(username)
  if (!targetId) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (targetId === viewer.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  // Check if already following
  const { data: existing } = await service
    .from('profile_follows')
    .select('id')
    .eq('follower_id', viewer.id)
    .eq('following_id', targetId)
    .maybeSingle()

  if (existing) {
    // Unfollow
    await service.from('profile_follows').delete().eq('follower_id', viewer.id).eq('following_id', targetId)
    return NextResponse.json({ following: false })
  } else {
    // Follow
    const { error } = await service.from('profile_follows').insert({ follower_id: viewer.id, following_id: targetId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ following: true })
  }
}

// GET /api/users/[username]/follow — get follow state + count for viewer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const service = getServiceClient()
  const targetId = await resolveTargetUserId(username)
  if (!targetId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const viewer = await requireAuth(req)

  const [followersResult, viewerFollowResult] = await Promise.all([
    service.from('profile_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetId),
    viewer
      ? service.from('profile_follows').select('id').eq('follower_id', viewer.id).eq('following_id', targetId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    followers_count: followersResult.count ?? 0,
    viewer_is_following: !!(viewer && viewerFollowResult.data),
  })
}
