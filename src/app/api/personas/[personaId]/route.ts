import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type UpdatePersonaPayload = {
  name?: string
  description?: string
}

async function getUserFromAuthHeader(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return { user: null, error: 'Unauthorized' }
  }

  const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Unauthorized' }
  }

  return { user, error: null }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { personaId } = await params
    if (!personaId) {
      return NextResponse.json({ error: 'Missing persona id' }, { status: 400 })
    }

    const body = (await req.json()) as UpdatePersonaPayload
    const name = body.name?.trim()
    const description = body.description?.trim()

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Persona name and description are required' },
        { status: 400 }
      )
    }

    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

    const { data: existing, error: existingError } = await serviceClient()
      .from('personas')
      .select('id,user_id')
      .eq('id', personaId)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await serviceClient()
      .from('personas')
      .update({ name, description })
      .eq('id', personaId)
      .select('id,name,description,avatar_url,created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ persona: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update persona'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { personaId } = await params
    if (!personaId) {
      return NextResponse.json({ error: 'Missing persona id' }, { status: 400 })
    }

    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

    const { data: existing, error: existingError } = await serviceClient()
      .from('personas')
      .select('id,user_id')
      .eq('id', personaId)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await serviceClient().from('personas').delete().eq('id', personaId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete persona'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
