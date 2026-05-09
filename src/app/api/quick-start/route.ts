/**
 * POST /api/quick-start
 *
 * Creates a group chat pre-loaded with a canonical cast of characters.
 *
 * Steps:
 * 1. Validate the requested universe and user auth.
 * 2. For each cast member, find an existing system bot or create one.
 * 3. Create the group chat with relationship context baked in.
 * 4. Add the user as a member, then add all cast bots.
 * 5. Return the new group chat id (and optionally the bot ids).
 *
 * Bots are owned by the SYSTEM_USER_ID (a dedicated admin-account UUID
 * stored in QUICK_START_SYSTEM_USER_ID env var). If that var is not set,
 * bots are owned by the requesting user as a fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCastByUniverse, getQuickStartUniverses, type CastMember } from '@/lib/quickStartCasts'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { user: null }
  const { data: { user }, error } = await authClient().auth.getUser(token)
  if (error || !user) return { user: null }
  return { user }
}

/** Build the relationship context text blob injected into the group chat. */
function buildRelationshipContext(members: CastMember[]): string {
  const lines: string[] = [
    '=== CANONICAL CHARACTER RELATIONSHIPS ===',
    'The following characters are present in this group chat. Their relationships should be respected and reflected in how they address one another.\n',
  ]

  for (const member of members) {
    if (member.relationships.length === 0) continue
    lines.push(`--- ${member.name} ---`)
    for (const rel of member.relationships) {
      const score = rel.relationship_score
      const sign = score > 0 ? '+' : ''
      lines.push(
        `• With ${rel.targetName} [Score: ${sign}${score}] [${rel.relationship_tags.join(', ')}]`
      )
      lines.push(`  Context: ${rel.relationship_context}`)
      lines.push(`  Summary: ${rel.relationship_summary}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** Upsert a system bot for a given cast member. Returns the bot id. */
async function upsertSystemBot(
  member: CastMember,
  universe: string,
  systemOwnerId: string
): Promise<string> {
  const sc = serviceClient()

  // Check if a system bot with this name + universe already exists
  const { data: existing } = await sc
    .from('bots')
    .select('id')
    .eq('creator_id', systemOwnerId)
    .eq('universe', universe)
    .eq('name', member.name)
    .maybeSingle()

  if (existing?.id) return existing.id

  const personalitySections = [
    member.personality ? `Core Personality: ${member.personality}` : null,
    member.backstory ? `Backstory: ${member.backstory}` : null,
    member.goals ? `Goals & Motivations: ${member.goals}` : null,
    member.style ? `Speaking Style: ${member.style}` : null,
  ].filter(Boolean)

  const personality = personalitySections.join('\n\n')

  const { data: created, error } = await sc
    .from('bots')
    .insert({
      creator_id: systemOwnerId,
      name: member.name,
      description: member.description,
      personality,
      universe,
      appearance: member.appearance ?? null,
      is_published: true,
    })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(`Failed to create bot for ${member.name}: ${error?.message ?? 'unknown error'}`)
  }

  return created.id
}

// GET /api/quick-start — return list of available universes and their casts
export async function GET() {
  const universes = getQuickStartUniverses()
  const castPreviews = universes.map((u) => {
    const cast = getCastByUniverse(u)!
    return {
      universe: cast.universe,
      groupName: cast.groupName,
      groupDescription: cast.groupDescription,
      memberNames: cast.members.map((m) => m.name),
      memberCount: cast.members.length,
    }
  })
  return NextResponse.json({ casts: castPreviews })
}

// POST /api/quick-start — create the group chat + bots
export async function POST(req: NextRequest) {
  try {
    const { user } = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { universe?: string; selectedPersonaId?: string }
    const universe = typeof body.universe === 'string' ? body.universe.trim() : ''

    if (!universe) {
      return NextResponse.json({ error: 'Universe is required' }, { status: 400 })
    }

    const cast = getCastByUniverse(universe)
    if (!cast) {
      return NextResponse.json(
        { error: `No quick-start cast available for universe: ${universe}` },
        { status: 400 }
      )
    }

    // Validate persona if provided
    const rawPersonaId = typeof body.selectedPersonaId === 'string' ? body.selectedPersonaId.trim() : ''
    let selectedPersonaId: string | null = null
    if (rawPersonaId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawPersonaId)
      if (!isUuid) {
        return NextResponse.json({ error: 'Invalid persona id' }, { status: 400 })
      }
      const { data: personaRow } = await serviceClient()
        .from('personas')
        .select('id, user_id')
        .eq('id', rawPersonaId)
        .maybeSingle()

      if (!personaRow || personaRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Invalid persona' }, { status: 403 })
      }
      selectedPersonaId = personaRow.id
    }

    // Determine the system owner id
    const systemOwnerId = process.env.QUICK_START_SYSTEM_USER_ID ?? user.id

    // Upsert all bots in the cast
    const botIds: string[] = []
    for (const member of cast.members) {
      const botId = await upsertSystemBot(member, cast.universe, systemOwnerId)
      botIds.push(botId)
    }

    // Build the relationship context text blob
    const relationshipContext = buildRelationshipContext(cast.members)

    // Create the group chat
    const { data: groupChat, error: chatError } = await serviceClient()
      .from('group_chats')
      .insert({
        name: cast.groupName,
        description: cast.groupDescription,
        creator_id: user.id,
        visibility: 'private',
        max_members: 5,
        group_type: 'roleplay',
        universe: cast.universe,
        persona_relationship_context: relationshipContext,
        is_active: true,
      })
      .select()
      .single()

    if (chatError || !groupChat) {
      return NextResponse.json({ error: chatError?.message ?? 'Failed to create group chat' }, { status: 500 })
    }

    // Add user as member
    const { error: memberError } = await serviceClient()
      .from('group_chat_members')
      .insert({
        group_chat_id: groupChat.id,
        user_id: user.id,
        is_moderator: true,
        persona_id: selectedPersonaId,
      })

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Add bots to the group chat
    if (botIds.length > 0) {
      const { error: botsError } = await serviceClient()
        .from('group_chat_bots')
        .insert(
          botIds.map((botId) => ({
            group_chat_id: groupChat.id,
            bot_id: botId,
            added_by: user.id,
          }))
        )

      if (botsError) {
        return NextResponse.json({ error: botsError.message }, { status: 500 })
      }
    }

    return NextResponse.json(
      {
        groupChatId: groupChat.id,
        botIds,
        groupName: cast.groupName,
        universe: cast.universe,
        memberCount: cast.members.length,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
