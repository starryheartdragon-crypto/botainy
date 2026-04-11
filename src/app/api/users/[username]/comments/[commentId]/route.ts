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

// DELETE /api/users/[username]/comments/[commentId]
// Authors can delete their own comments; profile owners can delete any on their profile
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; commentId: string }> }
) {
  try {
    const viewer = await requireAuth(req)
    if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { username, commentId } = await params
    const service = getServiceClient()

    const { data: target } = await service.from('users').select('id').eq('username', username).maybeSingle()
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: comment } = await service
      .from('profile_comments')
      .select('id, author_id, profile_user_id')
      .eq('id', commentId)
      .eq('profile_user_id', target.id)
      .maybeSingle()

    if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

    const canDelete = viewer.id === comment.author_id || viewer.id === comment.profile_user_id
    if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await service.from('profile_comments').delete().eq('id', commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
