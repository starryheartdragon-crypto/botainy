import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type ConnectionRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at?: string
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const action = String(body?.action || '')
    const peerUserId = String(body?.peerUserId || '')
    const { connectionId } = await params

    if (!isUuid(connectionId)) {
      if (!isUuid(peerUserId)) {
        return NextResponse.json({ error: 'Invalid connection identifier' }, { status: 400 })
      }
    }

    let byIdConnection: ConnectionRow | null = null
    let fetchError: { message?: string } | null = null
    if (isUuid(connectionId)) {
      const res = await serviceClient()
        .from('user_connections')
        .select('id, requester_id, addressee_id, status')
        .eq('id', connectionId)
        .maybeSingle()
      byIdConnection = res.data
      fetchError = res.error
    }

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    let connection = byIdConnection

    if (!connection && isUuid(peerUserId)) {
      const { data: pairRows, error: pairError } = await serviceClient()
        .from('user_connections')
        .select('id, requester_id, addressee_id, status, created_at')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${peerUserId}),and(requester_id.eq.${peerUserId},addressee_id.eq.${user.id})`
        )
        .order('created_at', { ascending: false })
        .limit(1)

      if (pairError) {
        return NextResponse.json({ error: pairError.message }, { status: 500 })
      }

      connection = (pairRows?.[0] as ConnectionRow | undefined) ?? null
    }

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const isRequester = connection.requester_id === user.id
    const isAddressee = connection.addressee_id === user.id
    if (!isRequester && !isAddressee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (action === 'accept') {
      if (!isAddressee || connection.status !== 'pending') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      const { data, error } = await serviceClient()
        .from('user_connections')
        .update({
          status: 'accepted',
        })
        .eq('id', connection.id)
        .select('id, requester_id, addressee_id, status, created_at')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (action === 'decline') {
      if (!isAddressee || connection.status !== 'pending') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      const { data, error } = await serviceClient()
        .from('user_connections')
        .update({
          status: 'declined',
        })
        .eq('id', connection.id)
        .select('id, requester_id, addressee_id, status, created_at')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (action === 'cancel') {
      if (!isRequester || connection.status !== 'pending') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      const { error } = await serviceClient()
        .from('user_connections')
        .delete()
        .eq('id', connection.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove') {
      if (connection.status !== 'accepted') {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      const { error } = await serviceClient()
        .from('user_connections')
        .delete()
        .eq('id', connection.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
