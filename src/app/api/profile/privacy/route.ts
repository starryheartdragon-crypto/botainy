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

const DEFAULT_PRIVACY = {
  show_bio: true,
  show_avatar: true,
  show_bots: true,
  show_music: true,
  show_connections_count: true,
  show_join_date: true,
}

// GET /api/profile/privacy — get current user's privacy settings
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceClient()
    const { data } = await service
      .from('profile_privacy_settings')
      .select('show_bio, show_avatar, show_bots, show_music, show_connections_count, show_join_date')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json(data ?? DEFAULT_PRIVACY)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// PUT /api/profile/privacy — upsert current user's privacy settings
export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const allowedKeys = Object.keys(DEFAULT_PRIVACY) as Array<keyof typeof DEFAULT_PRIVACY>
    const updates: Partial<typeof DEFAULT_PRIVACY> = {}

    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (typeof body[key] !== 'boolean') {
          return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 })
        }
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const service = getServiceClient()
    const { error } = await service
      .from('profile_privacy_settings')
      .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return updated settings
    const { data } = await service
      .from('profile_privacy_settings')
      .select('show_bio, show_avatar, show_bots, show_music, show_connections_count, show_join_date')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json(data ?? { ...DEFAULT_PRIVACY, ...updates })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
