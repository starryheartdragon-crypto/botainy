import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
const MAX_PERSONA_RELATIONSHIP_CONTEXT = 2000

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

// GET /api/group-chats/[groupChatId]/members/me
// Returns the current user's membership record, including their active persona_id for this group.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    const svc = serviceClient()

    const { data, error } = await svc
      .from('group_chat_members')
      .select('id, group_chat_id, user_id, joined_at, is_moderator, persona_id, relationship_score, relationship_context')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

// PATCH /api/group-chats/[groupChatId]/members/me
// Persists the current user's group persona and optionally appends personal relationship context.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    const body = await req.json().catch(() => ({}))

    const rawPersonaId = String(body?.personaId || '').trim()
    const rawRelationshipContext = String(body?.relationshipContext || '').trim()
    const rawRelationshipScore = typeof body?.relationshipScore === 'number'
      ? Math.max(-100, Math.min(100, Math.round(body.relationshipScore)))
      : null
    // Legacy flag — kept for backward compat but no longer used for group-level append
    const _appendRelationshipContext = body?.appendRelationshipContext !== false

    const svc = serviceClient()

    const { data: membership, error: membershipError } = await svc
      .from('group_chat_members')
      .select('id')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let personaIdToSave: string | null = null
    if (rawPersonaId) {
      const { data: personaRow, error: personaError } = await svc
      .from('personas')
        .select('id, user_id')
        .eq('id', rawPersonaId)
        .maybeSingle()

      if (personaError) return NextResponse.json({ error: personaError.message }, { status: 500 })
      if (!personaRow || personaRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Invalid persona for current user' }, { status: 403 })
      }

      personaIdToSave = personaRow.id
    }

    const memberUpdate: Record<string, unknown> = { persona_id: personaIdToSave }
    if (rawRelationshipContext) memberUpdate.relationship_context = rawRelationshipContext
    if (rawRelationshipScore !== null) memberUpdate.relationship_score = rawRelationshipScore

    const { error: updateMembershipError } = await svc
      .from('group_chat_members')
      .update(memberUpdate)
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)

    if (updateMembershipError) {
      return NextResponse.json({ error: updateMembershipError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, persona_id: personaIdToSave })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
