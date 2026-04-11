import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await authClient().auth.getUser(token)
  if (error || !user) return null
  return user
}

/** Resolve if the requesting user is a DM-role member of this group chat. */
async function isDmMember(svc: ReturnType<typeof serviceClient>, groupChatId: string, userId: string): Promise<boolean> {
  // DM role = group creator, moderator, or listed as dm_user_id
  const { data: group } = await svc
    .from('group_chats')
    .select('creator_id, dm_user_id, dm_mode')
    .eq('id', groupChatId)
    .maybeSingle()

  if (!group) return false
  if (group.creator_id === userId) return true
  if (group.dm_mode === 'user' && group.dm_user_id === userId) return true

  const { data: member } = await svc
    .from('group_chat_members')
    .select('is_moderator')
    .eq('group_chat_id', groupChatId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!(member as { is_moderator?: boolean } | null)?.is_moderator
}

// ---------------------------------------------------------------------------
// GET /api/group-chats/[groupChatId]/bestiary
// Returns the bestiary list with active status for each bot.
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params

    const svc = serviceClient()

    // Must be a member
    const { data: member } = await svc
      .from('group_chat_members')
      .select('id')
      .eq('group_chat_id', groupChatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch bestiary bots with their details
    const { data: bestiaryRows, error } = await svc
      .from('group_chat_bestiary')
      .select('bot_id, bots(id, name, avatar_url, personality)')
      .eq('group_chat_id', groupChatId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fetch currently active bots in the group
    const { data: activeBotRows } = await svc
      .from('group_chat_bots')
      .select('bot_id')
      .eq('group_chat_id', groupChatId)

    const activeBotIds = new Set(
      (activeBotRows || []).map((r: { bot_id: string }) => r.bot_id)
    )

    const bestiary = (bestiaryRows || []).map((row: Record<string, unknown>) => {
      const bot = row.bots as { id: string; name: string; avatar_url: string | null; personality: string } | null
      return {
        botId: String(row.bot_id || ''),
        name: bot?.name ?? 'Unknown',
        avatarUrl: bot?.avatar_url ?? null,
        isEncounter: bot?.personality?.includes('TTRPG Role: Encounter') ?? false,
        active: activeBotIds.has(String(row.bot_id || '')),
      }
    })

    return NextResponse.json({ bestiary })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/group-chats/[groupChatId]/bestiary
// Body: { action: 'summon' | 'eject', botId: string }
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    if (!isUuid(groupChatId)) return NextResponse.json({ error: 'Invalid group chat id' }, { status: 400 })

    const svc = serviceClient()

    // DM-role check
    const dm = await isDmMember(svc, groupChatId, user.id)
    if (!dm) return NextResponse.json({ error: 'Only DM-role members can summon or eject encounters' }, { status: 403 })

    const body = await req.json()
    const action = String(body?.action || '').trim()
    const botId = String(body?.botId || '').trim()

    if (!['summon', 'eject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "summon" or "eject"' }, { status: 400 })
    }
    if (!isUuid(botId)) return NextResponse.json({ error: 'Invalid bot id' }, { status: 400 })

    // Bot must be in this group's bestiary
    const { data: bestiaryEntry } = await svc
      .from('group_chat_bestiary')
      .select('bot_id')
      .eq('group_chat_id', groupChatId)
      .eq('bot_id', botId)
      .maybeSingle()

    if (!bestiaryEntry) {
      return NextResponse.json({ error: 'Bot is not in the encounter bestiary for this group' }, { status: 404 })
    }

    if (action === 'summon') {
      // Upsert into group_chat_bots
      const { error: summonError } = await svc
        .from('group_chat_bots')
        .upsert({ group_chat_id: groupChatId, bot_id: botId, added_by: user.id }, { onConflict: 'group_chat_id,bot_id' })

      if (summonError) return NextResponse.json({ error: summonError.message }, { status: 500 })

      return NextResponse.json({ ok: true, action: 'summoned', botId })
    }

    // eject — remove from group_chat_bots, leave bestiary intact
    const { error: ejectError } = await svc
      .from('group_chat_bots')
      .delete()
      .eq('group_chat_id', groupChatId)
      .eq('bot_id', botId)

    if (ejectError) return NextResponse.json({ error: ejectError.message }, { status: 500 })

    return NextResponse.json({ ok: true, action: 'ejected', botId })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
