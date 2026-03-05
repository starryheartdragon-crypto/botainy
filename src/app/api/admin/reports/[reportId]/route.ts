import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type ReportStatus = 'resolved' | 'rejected'

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { user, error: adminError } = await requireAdmin(req)
    if (adminError || !user) return adminError

    const { reportId } = await params
    if (!UUID_REGEX.test(reportId)) {
      return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
    }

    const body = (await req.json()) as { status?: ReportStatus }
    const status = body.status

    if (status !== 'resolved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status must be resolved or rejected' }, { status: 400 })
    }

    const { data, error } = await serviceClient()
      .from('reports')
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', reportId)
      .select('id, status, resolved_at, resolved_by')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: data }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
