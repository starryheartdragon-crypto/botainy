import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type CreatePersonaPayload = {
  name?: string
  description?: string
  avatarUrl?: string | null
}

async function getUserFromAuthHeader(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return { user: null, error: 'Unauthorized' }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Unauthorized' }
  }

  return { user, error: null }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await serviceClient
      .from('personas')
      .select('id,name,description,avatar_url,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ personas: data ?? [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load personas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const {
      user,
      error: authError,
    } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as CreatePersonaPayload
    const name = body.name?.trim() || ''
    const description = body.description?.trim() || ''
    const avatarUrl = body.avatarUrl ?? null

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Persona name and description are required' },
        { status: 400 }
      )
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await serviceClient
      .from('personas')
      .insert({
        user_id: user.id,
        name,
        description,
        avatar_url: avatarUrl,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create persona'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
