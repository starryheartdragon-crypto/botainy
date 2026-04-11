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

async function verifyOwner(service: ReturnType<typeof getServiceClient>, chatId: string, userId: string) {
  const { data, error } = await service
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', userId)
    .maybeSingle()
  return !error && !!data
}

const DEFAULTS = {
  relationship_context: '',
  relationship_score: 0,
  relationship_tags: [] as string[],
  relationship_events: [] as unknown[],
  relationship_summary: null as string | null,
}

// GET /api/chats/[chatId]/relationship?personaId=xxx
// Returns the relationship row for this (chat, persona) pair.
// Creates a default row if none exists yet.
export async function GET(
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
    if (!(await verifyOwner(service, chatId, user.id))) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { data, error } = await service
      .from('chat_persona_relationships')
      .select('relationship_context, relationship_score, relationship_tags, relationship_events, relationship_summary')
      .eq('chat_id', chatId)
      .eq('persona_id', personaId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data) {
      // Return defaults without inserting — row is created on first PATCH
      return NextResponse.json(DEFAULTS)
    }

    return NextResponse.json({
      relationship_context: data.relationship_context ?? '',
      relationship_score: typeof data.relationship_score === 'number' ? data.relationship_score : 0,
      relationship_tags: Array.isArray(data.relationship_tags) ? data.relationship_tags : [],
      relationship_events: Array.isArray(data.relationship_events) ? data.relationship_events : [],
      relationship_summary: data.relationship_summary ?? null,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// PATCH /api/chats/[chatId]/relationship?personaId=xxx
// Upserts relationship fields for this (chat, persona) pair.
export async function PATCH(
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
    if (!(await verifyOwner(service, chatId, user.id))) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if (Object.prototype.hasOwnProperty.call(body, 'relationship_context')) {
      const ctx = body.relationship_context
      if (typeof ctx !== 'string' && ctx !== null) {
        return NextResponse.json({ error: 'relationship_context must be a string or null' }, { status: 400 })
      }
      updates.relationship_context = typeof ctx === 'string' ? ctx.slice(0, 600) : ''
    }

    if (Object.prototype.hasOwnProperty.call(body, 'relationship_score')) {
      const score = body.relationship_score
      if (typeof score !== 'number' || score < -100 || score > 100) {
        return NextResponse.json({ error: 'relationship_score must be an integer between -100 and 100' }, { status: 400 })
      }
      updates.relationship_score = Math.round(score)
    }

    if (Object.prototype.hasOwnProperty.call(body, 'relationship_tags')) {
      const tags = body.relationship_tags
      if (!Array.isArray(tags) || tags.length > 10 || tags.some((t) => typeof t !== 'string' || t.length > 40)) {
        return NextResponse.json({ error: 'relationship_tags must be an array of up to 10 strings (max 40 chars each)' }, { status: 400 })
      }
      updates.relationship_tags = tags
    }

    if (Object.prototype.hasOwnProperty.call(body, 'relationship_summary')) {
      const summary = body.relationship_summary
      if (typeof summary !== 'string' && summary !== null) {
        return NextResponse.json({ error: 'relationship_summary must be a string or null' }, { status: 400 })
      }
      updates.relationship_summary = summary
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const { error } = await service
      .from('chat_persona_relationships')
      .upsert(
        { chat_id: chatId, persona_id: personaId, ...updates },
        { onConflict: 'chat_id,persona_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
