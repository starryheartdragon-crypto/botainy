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

async function getOptionalAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const { data: { user }, error } = await getAnonClient().auth.getUser(token)
  return (!error && user) ? user : null
}

// GET /api/users/[username]/comments — public guestbook (paginated)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const service = getServiceClient()
    const url = new URL(req.url)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 50)
    const offset = Number(url.searchParams.get('offset') ?? '0')

    const { data: target } = await service.from('users').select('id').eq('username', username).maybeSingle()
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: comments, count, error } = await service
      .from('profile_comments')
      .select('id, content, created_at, author_id, users!profile_comments_author_id_fkey(username, avatar_url)', { count: 'exact' })
      .eq('profile_user_id', target.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ comments: comments ?? [], total: count ?? 0 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/users/[username]/comments — add a guestbook comment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const viewer = await getOptionalAuth(req)
    if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { username } = await params
    const service = getServiceClient()

    const { data: target } = await service.from('users').select('id').eq('username', username).maybeSingle()
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json()
    const content: unknown = body.content
    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }
    const trimmed = content.trim()
    if (trimmed.length > 500) {
      return NextResponse.json({ error: 'Comment exceeds 500 characters' }, { status: 400 })
    }

    const { data: comment, error } = await service
      .from('profile_comments')
      .insert({ author_id: viewer.id, profile_user_id: target.id, content: trimmed })
      .select('id, content, created_at, author_id, users!profile_comments_author_id_fkey(username, avatar_url)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(comment, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
