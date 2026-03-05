import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type BasicUser = {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
  is_admin: boolean | null
}

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
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()

    const { data: incomingRows, error: incomingError } = await serviceClient()
      .from('user_connections')
      .select('id, requester_id, addressee_id, status, created_at')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (incomingError) {
      return NextResponse.json({ error: incomingError.message }, { status: 500 })
    }

    const { data: outgoingRows, error: outgoingError } = await serviceClient()
      .from('user_connections')
      .select('id, requester_id, addressee_id, status, created_at')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (outgoingError) {
      return NextResponse.json({ error: outgoingError.message }, { status: 500 })
    }

    const { data: acceptedRows, error: acceptedError } = await serviceClient()
      .from('user_connections')
      .select('id, requester_id, addressee_id, status, created_at')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (acceptedError) {
      return NextResponse.json({ error: acceptedError.message }, { status: 500 })
    }

    const incomingIds = (incomingRows || []).map((row) => row.requester_id)
    const outgoingIds = (outgoingRows || []).map((row) => row.addressee_id)
    const connectionIds = (acceptedRows || []).map((row) =>
      row.requester_id === user.id ? row.addressee_id : row.requester_id
    )

    const allUserIds = Array.from(new Set([...incomingIds, ...outgoingIds, ...connectionIds]))

    let usersById: Record<string, BasicUser> = {}
    if (allUserIds.length > 0) {
      const { data: users, error: usersError } = await serviceClient()
      .from('users')
        .select('id, username, avatar_url, bio, is_admin')
        .in('id', allUserIds)

      if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 })
      }

      usersById = Object.fromEntries((users || []).map((u) => [u.id, u]))
    }

    const incoming = (incomingRows || []).map((row) => ({
      ...row,
      user: usersById[row.requester_id] || null,
    }))

    const outgoing = (outgoingRows || []).map((row) => ({
      ...row,
      user: usersById[row.addressee_id] || null,
    }))

    const connections = (acceptedRows || []).map((row) => {
      const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id
      return {
        ...row,
        user: usersById[otherId] || null,
      }
    })

    const excludedIds = new Set<string>([user.id, ...incomingIds, ...outgoingIds, ...connectionIds])
    let discover: BasicUser[] = []

    if (q.length > 0) {
      const { data: discoverUsers, error: discoverError } = await serviceClient()
      .from('users')
        .select('id, username, avatar_url, bio, is_admin')
        .ilike('username', `%${q}%`)
        .limit(20)

      if (discoverError) {
        return NextResponse.json({ error: discoverError.message }, { status: 500 })
      }

      discover = (discoverUsers || []).filter((u) => !excludedIds.has(u.id))
    }

    return NextResponse.json({ incoming, outgoing, connections, discover })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const targetUserId = String(body?.targetUserId || '')

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 })
    }

    if (!isUuid(targetUserId)) {
      return NextResponse.json({ error: 'Invalid target user id' }, { status: 400 })
    }

    const { data: targetUser, error: targetError } = await serviceClient()
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    const { data: existingForward, error: existingForwardError } = await serviceClient()
      .from('user_connections')
      .select('id, status')
      .eq('requester_id', user.id)
      .eq('addressee_id', targetUserId)
      .maybeSingle()

    if (existingForwardError) {
      return NextResponse.json({ error: existingForwardError.message }, { status: 500 })
    }

    const { data: existingReverse, error: existingReverseError } = await serviceClient()
      .from('user_connections')
      .select('id, status')
      .eq('requester_id', targetUserId)
      .eq('addressee_id', user.id)
      .maybeSingle()

    if (existingReverseError) {
      return NextResponse.json({ error: existingReverseError.message }, { status: 500 })
    }

    const existing = existingForward || existingReverse

    if (existing && (existing.status === 'pending' || existing.status === 'accepted')) {
      return NextResponse.json({ error: 'Connection already exists' }, { status: 409 })
    }

    if (existing) {
      const { data: updated, error: updateError } = await serviceClient()
      .from('user_connections')
        .update({
          requester_id: user.id,
          addressee_id: targetUserId,
          status: 'pending',
        })
        .eq('id', existing.id)
        .select('id, requester_id, addressee_id, status, created_at')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json(updated, { status: 201 })
    }

    const { data: created, error: createError } = await serviceClient()
      .from('user_connections')
      .insert({
        requester_id: user.id,
        addressee_id: targetUserId,
        status: 'pending',
      })
      .select('id, requester_id, addressee_id, status, created_at')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
