import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const idsParam = (url.searchParams.get('ids') || '').trim()
    const rawIds = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    const uniqueIds = Array.from(new Set(rawIds)).filter(isUuid)
    if (uniqueIds.length === 0) {
      return NextResponse.json([])
    }

    const { data: users, error: usersError } = await serviceClient()
      .from('users')
      .select('id, username, avatar_url, is_admin')
      .in('id', uniqueIds)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const { data: acceptedAsRequester, error: reqError } = await serviceClient()
      .from('user_connections')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .in('requester_id', uniqueIds)

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }

    const { data: acceptedAsAddressee, error: addError } = await serviceClient()
      .from('user_connections')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .in('addressee_id', uniqueIds)

    if (addError) {
      return NextResponse.json({ error: addError.message }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    uniqueIds.forEach((id) => {
      counts[id] = 0
    })

    for (const row of acceptedAsRequester || []) {
      counts[row.requester_id] = (counts[row.requester_id] || 0) + 1
    }
    for (const row of acceptedAsAddressee || []) {
      counts[row.addressee_id] = (counts[row.addressee_id] || 0) + 1
    }

    const authUser = await getAuthUser(req)
    const relationById: Record<string, 'none' | 'pending_incoming' | 'pending_outgoing' | 'connected'> = {}
    uniqueIds.forEach((id) => {
      relationById[id] = 'none'
    })

    if (authUser) {
      const { data: outgoingRows, error: outError } = await serviceClient()
      .from('user_connections')
        .select('addressee_id, status')
        .eq('requester_id', authUser.id)
        .in('addressee_id', uniqueIds)

      if (outError) {
        return NextResponse.json({ error: outError.message }, { status: 500 })
      }

      const { data: incomingRows, error: inError } = await serviceClient()
      .from('user_connections')
        .select('requester_id, status')
        .eq('addressee_id', authUser.id)
        .in('requester_id', uniqueIds)

      if (inError) {
        return NextResponse.json({ error: inError.message }, { status: 500 })
      }

      for (const row of outgoingRows || []) {
        if (row.status === 'accepted') relationById[row.addressee_id] = 'connected'
        if (row.status === 'pending') relationById[row.addressee_id] = 'pending_outgoing'
      }

      for (const row of incomingRows || []) {
        if (row.status === 'accepted') relationById[row.requester_id] = 'connected'
        if (row.status === 'pending' && relationById[row.requester_id] !== 'connected') {
          relationById[row.requester_id] = 'pending_incoming'
        }
      }
    }

    const result = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      isAdmin: !!u.is_admin,
      connectionsCount: counts[u.id] || 0,
      relationStatus: relationById[u.id] || 'none',
    }))

    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
