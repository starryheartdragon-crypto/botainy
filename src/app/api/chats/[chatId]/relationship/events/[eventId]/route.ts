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

type RelationshipEvent = { id: string; date: string; description: string }

function parseEvents(raw: unknown): RelationshipEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is RelationshipEvent =>
      e !== null &&
      typeof e === 'object' &&
      typeof (e as RelationshipEvent).id === 'string' &&
      typeof (e as RelationshipEvent).description === 'string'
  )
}

// DELETE /api/chats/[chatId]/relationship/events/[eventId]?personaId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; eventId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chatId, eventId } = await params
    const personaId = req.nextUrl.searchParams.get('personaId')
    if (!personaId) return NextResponse.json({ error: 'personaId is required' }, { status: 400 })

    const service = getServiceClient()

    // Verify chat ownership
    const { data: chatOwner, error: ownerError } = await service
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (ownerError || !chatOwner) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const { data: rel, error: relError } = await service
      .from('chat_persona_relationships')
      .select('relationship_events')
      .eq('chat_id', chatId)
      .eq('persona_id', personaId)
      .maybeSingle()

    if (relError || !rel) return NextResponse.json({ error: 'Relationship not found' }, { status: 404 })

    const events = parseEvents(rel.relationship_events)
    const updated = events.filter((e) => e.id !== eventId)

    if (updated.length === events.length) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error: updateError } = await service
      .from('chat_persona_relationships')
      .update({ relationship_events: updated })
      .eq('chat_id', chatId)
      .eq('persona_id', personaId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true, events: updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
