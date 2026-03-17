import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

const MAX_ADDITIONAL_USERS = 4
const MAX_BOTS = 12
const MAX_PERSONA_RELATIONSHIP_CONTEXT = 2000

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

type GroupChat = {
  id: string
  created_at: string
}

type GroupChatMembership = {
  group_chat_id: string
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

// GET /api/group-chats - Group chat feature (separate from chat rooms)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope')
    const { user } = await getAuthUser(req)

    if (scope === 'mine') {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: membershipRows, error: membershipError } = await serviceClient()
      .from('group_chat_members')
        .select('group_chat_id')
        .eq('user_id', user.id)

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
      }

      const memberGroupIds = (membershipRows || []).map((row) => row.group_chat_id)
      if (memberGroupIds.length === 0) {
        return NextResponse.json([])
      }

      const { data: memberChats, error: memberChatsError } = await serviceClient()
      .from('group_chats')
        .select('*, group_chat_members(count)')
        .eq('is_active', true)
        .in('id', memberGroupIds)
        .order('updated_at', { ascending: false })

      if (memberChatsError) {
        return NextResponse.json({ error: memberChatsError.message }, { status: 500 })
      }

      return NextResponse.json(memberChats || [])
    }

    // Get public/private group chats for group-chat feature only
    const { data: publicChats, error: publicError } = await serviceClient()
      .from('group_chats')
      .select('*, group_chat_members(count)')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (publicError) {
      return NextResponse.json({ error: publicError.message }, { status: 500 })
    }

    // Get user's private group chats if authenticated
    let userChats: GroupChat[] = []
    if (user) {
      const { data: membershipRows, error: membershipError } = await serviceClient()
      .from('group_chat_members')
        .select('group_chat_id')
        .eq('user_id', user.id)

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 })
      }

      const memberGroupIds = ((membershipRows as GroupChatMembership[] | null) || []).map(
        (row) => row.group_chat_id
      )
      if (memberGroupIds.length > 0) {
        const { data, error: privateError } = await serviceClient()
      .from('group_chats')
        .select('*, group_chat_members(count)')
        .eq('visibility', 'private')
        .eq('is_active', true)
        .in('id', memberGroupIds)
        .order('created_at', { ascending: false })

        if (privateError) {
          return NextResponse.json({ error: privateError.message }, { status: 500 })
        }

        userChats = ((data as GroupChat[] | null) || [])
      }
    }

    // Combine and deduplicate
    const allChats = [...(publicChats || []), ...userChats]
    const uniqueChats = Array.from(new Map(allChats.map(c => [c.id, c])).values())

    return NextResponse.json(uniqueChats)
  } catch (err: unknown) {
    console.error('Error fetching group chats:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/group-chats - Create a new group chat (not a chat room)
export async function POST(req: NextRequest) {
  try {
    const { user } = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      description,
      visibility = 'private',
      groupType: rawGroupType = 'general',
      rules: rawRules,
      universe: rawUniverse,
      dmMode: rawDmMode,
      dmUserId: rawDmUserId,
      dmBotId: rawDmBotId,
      selectedPersonaId: rawSelectedPersonaId,
      personaRelationshipContext: rawPersonaRelationshipContext,
    } = body

    const additionalUserIdsRaw = Array.isArray(body?.invitedUserIds)
      ? body.invitedUserIds
      : Array.isArray(body?.additionalUserIds)
      ? body.additionalUserIds
      : []

    const botIdsRaw = Array.isArray(body?.botIds) ? body.botIds : []

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name required' }, { status: 400 })
    }

    if (!['private', 'public'].includes(visibility)) {
      return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
    }

    const groupType =
      typeof rawGroupType === 'string' ? rawGroupType.trim().toLowerCase() : 'general'
    if (!['general', 'roleplay', 'ttrpg'].includes(groupType)) {
      return NextResponse.json({ error: 'Invalid group chat type' }, { status: 400 })
    }

    const additionalUserIds = Array.from(
      new Set<string>(
        additionalUserIdsRaw
          .map((id: unknown) => String(id || '').trim())
          .filter((id: string): id is string => id.length > 0)
          .filter((id: string) => id !== user.id)
      )
    )

    if (additionalUserIds.length > MAX_ADDITIONAL_USERS) {
      return NextResponse.json(
        { error: `You can add up to ${MAX_ADDITIONAL_USERS} other users.` },
        { status: 400 }
      )
    }

    if (additionalUserIds.some((id) => !isUuid(id))) {
      return NextResponse.json({ error: 'Invalid user id in invited users' }, { status: 400 })
    }

    if (additionalUserIds.length > 0) {
      const { data: validUsers, error: usersError } = await serviceClient()
      .from('users')
        .select('id')
        .in('id', additionalUserIds)

      if (usersError) {
        return NextResponse.json({ error: usersError.message }, { status: 500 })
      }

      if ((validUsers || []).length !== additionalUserIds.length) {
        return NextResponse.json({ error: 'One or more invited users are invalid' }, { status: 400 })
      }
    }

    const botIds = Array.from(
      new Set<string>(
        botIdsRaw
          .map((id: unknown) => String(id || '').trim())
          .filter((id: string): id is string => id.length > 0)
      )
    )

    if (botIds.length > MAX_BOTS) {
      return NextResponse.json({ error: `You can add up to ${MAX_BOTS} bots.` }, { status: 400 })
    }

    if (botIds.some((id) => !isUuid(id))) {
      return NextResponse.json({ error: 'Invalid bot id' }, { status: 400 })
    }

    if (botIds.length > 0) {
      const { data: bots, error: botsError } = await serviceClient()
      .from('bots')
        .select('id, creator_id, is_published')
        .in('id', botIds)

      if (botsError) {
        return NextResponse.json({ error: botsError.message }, { status: 500 })
      }

      if ((bots || []).length !== botIds.length) {
        return NextResponse.json({ error: 'One or more selected bots are invalid' }, { status: 400 })
      }

      const unauthorizedBot = (bots || []).find(
        (bot) => bot.creator_id !== user.id && !bot.is_published
      )

      if (unauthorizedBot) {
        return NextResponse.json({ error: 'Cannot add private bots you do not own' }, { status: 403 })
      }
    }

    const trimmedRules = typeof rawRules === 'string' ? rawRules.trim() : ''
    const trimmedUniverse = typeof rawUniverse === 'string' ? rawUniverse.trim() : ''
    const trimmedPersonaRelationshipContext =
      typeof rawPersonaRelationshipContext === 'string'
        ? rawPersonaRelationshipContext.trim()
        : ''

    if (trimmedPersonaRelationshipContext.length > MAX_PERSONA_RELATIONSHIP_CONTEXT) {
      return NextResponse.json(
        {
          error: `Persona relationship notes must be ${MAX_PERSONA_RELATIONSHIP_CONTEXT} characters or less`,
        },
        { status: 400 }
      )
    }

    let rules: string | null = null
    let universe: string | null = null
    let dmMode: 'user' | 'bot' | null = null
    let dmUserId: string | null = null
    let dmBotId: string | null = null
    let selectedPersonaId: string | null = null
    let personaRelationshipContext: string | null = null

    const parsedSelectedPersonaId = String(rawSelectedPersonaId || '').trim()
    if (parsedSelectedPersonaId) {
      if (!isUuid(parsedSelectedPersonaId)) {
        return NextResponse.json({ error: 'Invalid selected persona id' }, { status: 400 })
      }

      const { data: personaRow, error: personaError } = await serviceClient()
      .from('personas')
        .select('id, user_id')
        .eq('id', parsedSelectedPersonaId)
        .maybeSingle()

      if (personaError) {
        return NextResponse.json({ error: personaError.message }, { status: 500 })
      }

      if (!personaRow || personaRow.user_id !== user.id) {
        return NextResponse.json({ error: 'Selected persona is invalid for this user' }, { status: 403 })
      }

      selectedPersonaId = personaRow.id
    }

    if (groupType === 'ttrpg') {
      if (!trimmedRules) {
        return NextResponse.json({ error: 'TTRPG group chats require rules' }, { status: 400 })
      }

      const parsedDmMode =
        typeof rawDmMode === 'string' ? rawDmMode.trim().toLowerCase() : ''
      if (parsedDmMode !== 'user' && parsedDmMode !== 'bot') {
        return NextResponse.json({ error: 'TTRPG group chats require a DM type' }, { status: 400 })
      }

      dmMode = parsedDmMode
      rules = trimmedRules

      if (dmMode === 'user') {
        const parsedDmUserId = String(rawDmUserId || '').trim()
        if (!parsedDmUserId || !isUuid(parsedDmUserId)) {
          return NextResponse.json({ error: 'Valid DM user is required for TTRPG chats' }, { status: 400 })
        }

        const canUseDmUser = parsedDmUserId === user.id || additionalUserIds.includes(parsedDmUserId)
        if (!canUseDmUser) {
          return NextResponse.json(
            { error: 'DM user must be you or one of the invited users' },
            { status: 400 }
          )
        }

        dmUserId = parsedDmUserId
      }

      if (dmMode === 'bot') {
        const parsedDmBotId = String(rawDmBotId || '').trim()
        if (!parsedDmBotId || !isUuid(parsedDmBotId)) {
          return NextResponse.json({ error: 'Valid DM bot is required for TTRPG chats' }, { status: 400 })
        }

        if (!botIds.includes(parsedDmBotId)) {
          return NextResponse.json(
            { error: 'DM bot must be selected in the group bots list' },
            { status: 400 }
          )
        }

        dmBotId = parsedDmBotId
      }
    } else if (groupType === 'roleplay') {
      rules = trimmedRules || null
      universe = trimmedUniverse || null
    }

    if (groupType === 'roleplay' || groupType === 'ttrpg') {
      personaRelationshipContext = trimmedPersonaRelationshipContext || null
    }

    // Create group chat
    const { data: groupChat, error: createError } = await serviceClient()
      .from('group_chats')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        creator_id: user.id,
        visibility,
        max_members: MAX_ADDITIONAL_USERS + 1,
        group_type: groupType,
        rules,
        universe,
        dm_mode: dmMode,
        dm_user_id: dmUserId,
        dm_bot_id: dmBotId,
        persona_relationship_context: personaRelationshipContext,
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Add creator as member
    const { error: creatorMemberError } = await serviceClient()
      .from('group_chat_members')
      .insert({
        group_chat_id: groupChat.id,
        user_id: user.id,
        is_moderator: true,
        persona_id: selectedPersonaId,
      })

    if (creatorMemberError) {
      return NextResponse.json({ error: creatorMemberError.message }, { status: 500 })
    }

    if (additionalUserIds.length > 0) {
      const { error: membersError } = await serviceClient()
      .from('group_chat_members')
        .insert(
          additionalUserIds.map((memberId) => ({
            group_chat_id: groupChat.id,
            user_id: memberId,
            is_moderator: false,
          }))
        )

      if (membersError) {
        return NextResponse.json({ error: membersError.message }, { status: 500 })
      }
    }

    if (botIds.length > 0) {
      const { error: botsInsertError } = await serviceClient()
      .from('group_chat_bots')
        .insert(
          botIds.map((botId) => ({
            group_chat_id: groupChat.id,
            bot_id: botId,
            added_by: user.id,
          }))
        )

      if (botsInsertError) {
        return NextResponse.json({ error: botsInsertError.message }, { status: 500 })
      }
    }

    return NextResponse.json(groupChat, { status: 201 })
  } catch (err: unknown) {
    console.error('Error creating group chat:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
