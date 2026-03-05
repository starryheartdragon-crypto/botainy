import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type ResourceType = 'reports' | 'bots' | 'users'

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) return null
  return user
}

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: userRow, error: userError } = await serviceClient()
      .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (userError) {
    return { user: null, error: NextResponse.json({ error: userError.message }, { status: 500 }) }
  }

  if (!userRow?.is_admin) {
    return { user: null, error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function GET(req: NextRequest) {
  try {
    const { error: adminError } = await requireAdmin(req)
    if (adminError) return adminError

    const { searchParams } = new URL(req.url)
    const resource = searchParams.get('resource') as ResourceType | null

    if (!resource || !['reports', 'bots', 'users'].includes(resource)) {
      return NextResponse.json({ error: 'resource must be reports, bots, or users' }, { status: 400 })
    }

    if (resource === 'reports') {
      const { data, error } = await serviceClient()
      .from('reports')
        .select('id, reporter_id, reported_user_id, reported_bot_id, reason, details, status, created_at, resolved_at, resolved_by')
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ reports: data ?? [] }, { status: 200 })
    }

    if (resource === 'bots') {
      const { data, error } = await serviceClient()
      .from('bots')
        .select('id, name, creator_id, description, is_published, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ bots: data ?? [] }, { status: 200 })
    }

    const { data, error } = await serviceClient()
      .from('users')
      .select('id, username, email, is_banned, is_silenced, is_admin, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
