import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type ReportTargetType = 'bot' | 'user'

type CreateReportPayload = {
  targetType?: ReportTargetType
  targetId?: string
  reason?: string
  details?: string
}

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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as CreateReportPayload
    const targetType = body.targetType
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const details = typeof body.details === 'string' ? body.details.trim() : ''

    if (targetType !== 'bot' && targetType !== 'user') {
      return NextResponse.json({ error: 'targetType must be bot or user' }, { status: 400 })
    }

    if (!UUID_REGEX.test(targetId)) {
      return NextResponse.json({ error: 'Invalid target id' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    if (targetType === 'user' && targetId === user.id) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 })
    }

    if (targetType === 'user') {
      const { data: reportedUser, error: reportedUserError } = await serviceClient()
      .from('users')
        .select('id')
        .eq('id', targetId)
        .maybeSingle()

      if (reportedUserError) {
        return NextResponse.json({ error: reportedUserError.message }, { status: 500 })
      }

      if (!reportedUser) {
        return NextResponse.json({ error: 'Reported user not found' }, { status: 404 })
      }
    }

    if (targetType === 'bot') {
      const { data: reportedBot, error: reportedBotError } = await serviceClient()
      .from('bots')
        .select('id')
        .eq('id', targetId)
        .maybeSingle()

      if (reportedBotError) {
        return NextResponse.json({ error: reportedBotError.message }, { status: 500 })
      }

      if (!reportedBot) {
        return NextResponse.json({ error: 'Reported bot not found' }, { status: 404 })
      }
    }

    const insertPayload: {
      reporter_id: string
      reported_user_id?: string | null
      reported_bot_id?: string | null
      reason: string
      details?: string | null
    } = {
      reporter_id: user.id,
      reason,
      details: details || null,
    }

    if (targetType === 'user') {
      insertPayload.reported_user_id = targetId
      insertPayload.reported_bot_id = null
    } else {
      insertPayload.reported_user_id = null
      insertPayload.reported_bot_id = targetId
    }

    const { data, error } = await serviceClient()
      .from('reports')
      .insert(insertPayload)
      .select('id, reporter_id, reported_user_id, reported_bot_id, reason, details, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
