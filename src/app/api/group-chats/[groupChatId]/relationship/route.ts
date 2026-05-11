import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7) ?? null
  if (!token) return null
  const { data: { user }, error } = await authClient().auth.getUser(token)
  if (error || !user) return null
  return user
}

/** GET /api/group-chats/[groupChatId]/relationship?personaId=xxx
 *  Returns per-bot track_scores + milestones_achieved for the given persona.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    const personaId = req.nextUrl.searchParams.get('personaId')
    if (!personaId) return NextResponse.json({ error: 'personaId required' }, { status: 400 })

    const svc = serviceClient()

    // Verify the persona belongs to this user
    const { data: personaRow } = await svc
      .from('personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!personaRow) return NextResponse.json({ error: 'Persona not found' }, { status: 404 })

    // Get active bots in this group
    const { data: botLinks } = await svc
      .from('group_chat_bots')
      .select('bot_id, bots(id, name, avatar_url)')
      .eq('group_chat_id', groupChatId)

    const botIds = ((botLinks ?? []) as unknown as Array<{ bot_id: string; bots: { id: string; name: string; avatar_url: string | null } | null }>)
      .map((r) => r.bot_id)
      .filter(Boolean)

    // Get existing relationship rows
    const { data: relRows } = await svc
      .from('group_chat_persona_relationships')
      .select('bot_id, track_scores, milestones_achieved')
      .eq('group_chat_id', groupChatId)
      .eq('persona_id', personaId)
      .in('bot_id', botIds.length ? botIds : ['__none__'])

    const relMap = new Map(
      ((relRows ?? []) as Array<{ bot_id: string; track_scores: unknown[]; milestones_achieved: unknown[] }>)
        .map((r) => [r.bot_id, { track_scores: r.track_scores ?? [], milestones_achieved: r.milestones_achieved ?? [] }])
    )

    const relationships = (botLinks ?? []).map((link) => {
      const bot = link.bots as unknown as { id: string; name: string; avatar_url: string | null } | null
      const rel = relMap.get(link.bot_id) ?? { track_scores: [], milestones_achieved: [] }
      return {
        bot_id: link.bot_id,
        bot_name: bot?.name ?? 'Bot',
        bot_avatar_url: bot?.avatar_url ?? null,
        track_scores: rel.track_scores,
        milestones_achieved: rel.milestones_achieved,
      }
    })

    return NextResponse.json({ relationships })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
