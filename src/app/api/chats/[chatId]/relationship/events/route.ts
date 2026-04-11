import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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

// POST /api/chats/[chatId]/relationship/events?personaId=xxx — add an event to the log
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chatId } = await params
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

    const body = await req.json()
    const description: unknown = body.description
    const date: unknown = body.date

    if (typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (typeof date !== 'string' || !date.trim()) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }

    const trimmedDesc = description.trim().slice(0, 300)
    const trimmedDate = date.trim().slice(0, 50)

    // Fetch current relationship row
    const { data: rel, error: relError } = await service
      .from('chat_persona_relationships')
      .select('relationship_events')
      .eq('chat_id', chatId)
      .eq('persona_id', personaId)
      .maybeSingle()

    if (relError) return NextResponse.json({ error: relError.message }, { status: 500 })

    const events = parseEvents(rel?.relationship_events)
    if (events.length >= 50) {
      return NextResponse.json({ error: 'Maximum of 50 events reached' }, { status: 400 })
    }

    const newEvent: RelationshipEvent = { id: randomUUID(), date: trimmedDate, description: trimmedDesc }
    const updated = [...events, newEvent]

    const { error: upsertError } = await service
      .from('chat_persona_relationships')
      .upsert(
        { chat_id: chatId, persona_id: personaId, relationship_events: updated },
        { onConflict: 'chat_id,persona_id' }
      )

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    return NextResponse.json({ event: newEvent, events: updated }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
