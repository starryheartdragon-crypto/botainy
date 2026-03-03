import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(supabaseUrl, serviceRoleKey)
const authClient = createClient(supabaseUrl, supabaseAnonKey)

export async function GET() {
  try {
    const { data, error } = await serviceClient
      .from('chat_rooms')
      .select('id, name, description, background_url, city_info, notable_bots, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRow, error: userError } = await serviceClient
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    if (!userRow?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const name = String(body?.name || '').trim()
    const description = String(body?.description || '').trim()
    const backgroundUrl = String(body?.background_url || '').trim()
    const cityInfo = String(body?.city_info || '').trim()
    const notableBots = String(body?.notable_bots || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    const { data, error } = await serviceClient
      .from('chat_rooms')
      .insert({
        name,
        description: description || null,
        background_url: backgroundUrl || null,
        city_info: cityInfo || null,
        notable_bots: notableBots || null,
      })
      .select('id, name, description, background_url, city_info, notable_bots, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
