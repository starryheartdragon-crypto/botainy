import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
const MAX_PERSONA_RELATIONSHIP_CONTEXT = 2000

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) return { user: null }

  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) return { user: null }
  return { user }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const { user } = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await params
    const body = await req.json().catch(() => ({}))
    const rawPersonaId = String(body?.personaId || '').trim()
    const rawRelationshipContext = String(body?.relationshipContext || '').trim()
    const appendRelationshipContext = body?.appendRelationshipContext !== false

    let personaIdToSave: string | null = null
    if (rawPersonaId) {
      if (!isUuid(rawPersonaId)) {
        return NextResponse.json({ error: 'Invalid persona id' }, { status: 400 })
      }

      const { data: personaRow, error: personaError } = await serviceClient()
      .from('personas')
        .select('id, user_id')
        .eq('id', rawPersonaId)
        .maybeSingle()

      if (personaError) {
        return NextResponse.json({ error: personaError.message }, { status: 500 })
      }
      if (!personaRow || personaRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Invalid persona for current user' }, { status: 403 })
      }

      personaIdToSave = personaRow.id
    }

    const { data: chat, error: chatError } = await serviceClient()
      .from('group_chats')
      .select('id, visibility, is_active, max_members')
      .eq('id', groupChatId)
      .single()

    if (chatError || !chat || !chat.is_active) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const { count: memberCount } = await serviceClient()
      .from('group_chat_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_chat_id', groupChatId)

    if ((memberCount || 0) >= (chat.max_members || 50)) {
      return NextResponse.json({ error: 'Group is full' }, { status: 400 })
    }

    const { data: existing } = await serviceClient()
      .from('group_chat_members')
      .select('id')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      if (rawPersonaId) {
        const { error: updateMemberError } = await serviceClient()
          .from('group_chat_members')
          .update({ persona_id: personaIdToSave })
          .eq('group_chat_id', groupChatId)
          .eq('user_id', user.id)

        if (updateMemberError) {
          return NextResponse.json({ error: updateMemberError.message }, { status: 500 })
        }
      }

      if (rawRelationshipContext) {
        const { data: groupRow, error: groupError } = await serviceClient()
      .from('group_chats')
          .select('persona_relationship_context')
          .eq('id', groupChatId)
          .maybeSingle()

        if (groupError) {
          return NextResponse.json({ error: groupError.message }, { status: 500 })
        }

        const existingContext = String(groupRow?.persona_relationship_context || '').trim()
        const entry = `User ${user.id}: ${rawRelationshipContext}`
        const nextContext = appendRelationshipContext && existingContext
          ? `${existingContext}\n\n${entry}`
          : entry

        if (nextContext.length > MAX_PERSONA_RELATIONSHIP_CONTEXT) {
          return NextResponse.json(
            { error: `Relationship context must be ${MAX_PERSONA_RELATIONSHIP_CONTEXT} characters or less` },
            { status: 400 }
          )
        }

        const { error: contextUpdateError } = await serviceClient()
          .from('group_chats')
          .update({
            persona_relationship_context: nextContext,
            updated_at: new Date().toISOString(),
          })
          .eq('id', groupChatId)

        if (contextUpdateError) {
          return NextResponse.json({ error: contextUpdateError.message }, { status: 500 })
        }
      }

      return NextResponse.json({ ok: true, alreadyJoined: true })
    }

    const { error: joinError } = await serviceClient()
      .from('group_chat_members')
      .insert({
        group_chat_id: groupChatId,
        user_id: user.id,
        persona_id: personaIdToSave,
      })

    if (joinError) {
      return NextResponse.json({ error: joinError.message }, { status: 500 })
    }

    if (rawRelationshipContext) {
      const { data: groupRow, error: groupError } = await serviceClient()
      .from('group_chats')
        .select('persona_relationship_context')
        .eq('id', groupChatId)
        .maybeSingle()

      if (groupError) {
        return NextResponse.json({ error: groupError.message }, { status: 500 })
      }

      const existingContext = String(groupRow?.persona_relationship_context || '').trim()
      const entry = `User ${user.id}: ${rawRelationshipContext}`
      const nextContext = appendRelationshipContext && existingContext
        ? `${existingContext}\n\n${entry}`
        : entry

      if (nextContext.length > MAX_PERSONA_RELATIONSHIP_CONTEXT) {
        return NextResponse.json(
          { error: `Relationship context must be ${MAX_PERSONA_RELATIONSHIP_CONTEXT} characters or less` },
          { status: 400 }
        )
      }

      const { error: updateGroupError } = await serviceClient()
        .from('group_chats')
        .update({
          persona_relationship_context: nextContext,
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupChatId)

      if (updateGroupError) {
        return NextResponse.json({ error: updateGroupError.message }, { status: 500 })
      }
    } else {
      await serviceClient()
        .from('group_chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupChatId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const { user } = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await params

    const { error } = await serviceClient()
      .from('group_chat_members')
      .delete()
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
