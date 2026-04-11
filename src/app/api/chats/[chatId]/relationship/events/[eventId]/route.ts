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

// DELETE /api/chats/[chatId]/relationship/events/[eventId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string; eventId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chatId, eventId } = await params
    const service = getServiceClient()

    const { data: chat, error: chatError } = await service
      .from('chats')
      .select('id, user_id, relationship_events')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (chatError || !chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const events = parseEvents(chat.relationship_events)
    const updated = events.filter((e) => e.id !== eventId)

    if (updated.length === events.length) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error: updateError } = await service
      .from('chats')
      .update({ relationship_events: updated })
      .eq('id', chatId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true, events: updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
