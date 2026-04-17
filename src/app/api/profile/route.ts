import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest) {
  try {
    console.log('[Profile GET] Request received')
    
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      console.log('[Profile GET] No token found')
      return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    }

    console.log('[Profile GET] Validating token')
    const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await authClient().auth.getUser(token)

    if (authError || !user) {
      console.log('[Profile GET] Token validation failed:', authError?.message)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('[Profile GET] User ID:', user.id)
    
    // Use service role to avoid RLS issues
    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
    const { data: profile, error } = await serviceClient()
      .from('users')
      .select('id, username, bio, avatar_url, hard_boundaries, pronouns, location, accent_color, interest_tags')
      .eq('id', user.id)
      .maybeSingle()

    console.log('[Profile GET] Query result - error:', error?.message, 'has_profile:', !!profile)

    if (error) {
      console.log('[Profile GET] Query error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!profile) {
      console.log('[Profile GET] No profile found, returning empty')
      return NextResponse.json({ id: user.id, username: null, bio: null, avatar_url: null })
    }

    return NextResponse.json(profile)
  } catch (err: unknown) {
    console.error('[Profile GET] Exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    console.log('[Profile PUT] Request received')
    
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      console.log('[Profile PUT] No token provided')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Profile PUT] Token extracted, validating...')
    const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: authError } = await authClient().auth.getUser(token)

    if (authError || !user) {
      console.log('[Profile PUT] Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Profile PUT] User authenticated:', user.id)
    const body = await req.json()
    const { username, bio, avatar_url, hard_boundaries, pronouns, location, accent_color, interest_tags } = body
    console.log('[Profile PUT] Update data:', { username, bio, has_avatar: !!avatar_url, hard_boundaries })

    // Validate hard_boundaries if provided
    if (hard_boundaries !== undefined) {
      if (!Array.isArray(hard_boundaries) || hard_boundaries.some((b: unknown) => typeof b !== 'string')) {
        return NextResponse.json({ error: 'hard_boundaries must be an array of strings' }, { status: 400 })
      }
    }

    // Validate interest_tags
    if (interest_tags !== undefined) {
      if (!Array.isArray(interest_tags) || interest_tags.some((t: unknown) => typeof t !== 'string')) {
        return NextResponse.json({ error: 'interest_tags must be an array of strings' }, { status: 400 })
      }
      if (interest_tags.length > 20) {
        return NextResponse.json({ error: 'Maximum 20 interest tags allowed' }, { status: 400 })
      }
      if (interest_tags.some((t: string) => t.length > 30)) {
        return NextResponse.json({ error: 'Each interest tag must be 30 characters or less' }, { status: 400 })
      }
    }

    // Validate accent_color (must be valid hex or null)
    if (accent_color !== undefined && accent_color !== null) {
      if (typeof accent_color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accent_color)) {
        return NextResponse.json({ error: 'accent_color must be a valid hex color (e.g. #a855f7)' }, { status: 400 })
      }
    }

    // Use service role to update (bypasses RLS)
    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
    console.log('[Profile PUT] Updating user record with service role...')
    
    const { data, error } = await serviceClient()
      .from('users')
      .update({
        username,
        bio,
        avatar_url,
        ...(hard_boundaries !== undefined ? { hard_boundaries } : {}),
        ...(pronouns !== undefined ? { pronouns } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(accent_color !== undefined ? { accent_color } : {}),
        ...(interest_tags !== undefined ? { interest_tags } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .maybeSingle()

    console.log('[Profile PUT] Update result:', { error: error?.message, has_data: !!data })

    if (error) {
      console.log('[Profile PUT] Database error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Profile PUT] Success')
    return NextResponse.json(data || { id: user.id, username, bio, avatar_url })
  } catch (err: unknown) {
    console.error('[Profile PUT] Exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
