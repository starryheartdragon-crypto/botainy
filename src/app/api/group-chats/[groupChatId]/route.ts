import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

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

// GET /api/group-chats/[groupChatId] — fetch a single group chat
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await params

    const { data: group, error } = await serviceClient()
      .from('group_chats')
      .select('id, name, description, creator_id, is_nsfw, api_temperature, response_length, narrative_style, created_at, updated_at')
      .eq('id', groupChatId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!group) {
      return NextResponse.json({ error: 'Group chat not found' }, { status: 404 })
    }

    return NextResponse.json(group)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/group-chats/[groupChatId] — update group chat settings (e.g. is_nsfw)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await params
    const body = await req.json()
    const { is_nsfw, api_temperature, response_length, narrative_style } = body

    const updates: Record<string, unknown> = {}

    if (Object.prototype.hasOwnProperty.call(body, 'is_nsfw')) {
      if (typeof is_nsfw !== 'boolean') {
        return NextResponse.json({ error: 'is_nsfw must be a boolean' }, { status: 400 })
      }
      updates.is_nsfw = is_nsfw
    }

    if (Object.prototype.hasOwnProperty.call(body, 'api_temperature')) {
      if (typeof api_temperature !== 'number' || api_temperature < 0 || api_temperature > 2) {
        return NextResponse.json({ error: 'api_temperature must be a number between 0 and 2' }, { status: 400 })
      }
      updates.api_temperature = api_temperature
    }

    if (Object.prototype.hasOwnProperty.call(body, 'response_length')) {
      if (typeof response_length !== 'number' || ![0, 1, 2, 3, 4].includes(response_length)) {
        return NextResponse.json({ error: 'response_length must be 0, 1, 2, 3, or 4' }, { status: 400 })
      }
      updates.response_length = response_length
    }

    if (Object.prototype.hasOwnProperty.call(body, 'narrative_style')) {
      if (typeof narrative_style !== 'number' || ![0, 1, 2, 3, 4].includes(narrative_style)) {
        return NextResponse.json({ error: 'narrative_style must be 0, 1, 2, 3, or 4' }, { status: 400 })
      }
      updates.narrative_style = narrative_style
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    // Verify user is a member of this group chat
    const { data: membership, error: memberError } = await serviceClient()
      .from('group_chat_members')
      .select('user_id')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: updateError } = await serviceClient()
      .from('group_chats')
      .update(updates)
      .eq('id', groupChatId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...updates })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
