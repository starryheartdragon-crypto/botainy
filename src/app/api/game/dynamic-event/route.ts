import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BOT_UNIVERSES } from '@/lib/botUniverses'
import { checkRateLimit, getClientIpFromHeaders, rateLimitHeaders } from '@/lib/rateLimit'

type NarrativeNpc = {
  name: string
  role: string
  motive: string
  publicFace: string
  hiddenAgenda?: string
  relationship?: {
    affection?: number
    suspicion?: number
    fear?: number
  }
}

type NarrativePayload = {
  title: string
  worldState: {
    setting: string
    vibe: string
    techLevel: string
    immediateStakes: string
    pressure: string
  }
  npcs: NarrativeNpc[]
  incitingIncident: {
    scene: string
  }
  director: {
    openingBeat: string
    sensoryDetails: string
    tensionClock: string
  }
  dialogueStarter: {
    speaker: string
    line: string
  }
}

type DynamicEventRequest = {
  narrative?: NarrativePayload
  groupName?: string
  visibility?: 'private' | 'public'
}

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) || ''
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY) || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey)
}

function clampText(value: string, max = 1800) {
  return value.trim().slice(0, max)
}

function resolveBotUniverse(setting: string) {
  const normalizedSetting = setting.trim().toLowerCase()
  const directMatch = BOT_UNIVERSES.find((entry) => entry.toLowerCase() === normalizedSetting)
  if (directMatch) return directMatch

  const fuzzyMatch = BOT_UNIVERSES.find((entry) => normalizedSetting.includes(entry.toLowerCase()))
  if (fuzzyMatch) return fuzzyMatch

  return 'OC (Original Character)'
}

function sanitizeNpcName(name: string, index: number) {
  const fallback = `NPC ${index + 1}`
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 60) : fallback
}

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

function validateNarrative(payload: NarrativePayload | undefined): payload is NarrativePayload {
  if (!payload) return false
  if (!payload.title?.trim()) return false
  if (!payload.worldState?.setting?.trim()) return false
  if (!payload.worldState?.immediateStakes?.trim()) return false
  if (!payload.incitingIncident?.scene?.trim()) return false
  if (!payload.director?.openingBeat?.trim()) return false
  if (!Array.isArray(payload.npcs) || payload.npcs.length === 0) return false
  return true
}

export async function POST(req: NextRequest) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })
    }

    const limit = checkRateLimit({
      bucket: 'dynamic-event-create',
      key: getClientIpFromHeaders(req.headers),
      max: 12,
      windowMs: 60_000,
    })

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(limit),
            'Retry-After': String(limit.retryAfterSeconds),
          },
        }
      )
    }

    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rateLimitHeaders(limit) })
    }

    const body = (await req.json()) as DynamicEventRequest
    const narrative = body.narrative

    if (!validateNarrative(narrative)) {
      return NextResponse.json(
        { error: 'A valid generated narrative payload is required.' },
        { status: 400, headers: rateLimitHeaders(limit) }
      )
    }

    const visibility = body.visibility === 'public' ? 'public' : 'private'
    const requestedName = typeof body.groupName === 'string' ? body.groupName.trim() : ''
    const groupName = clampText(requestedName || `${narrative.title} - AI Event`, 120)

    const npcs = narrative.npcs.slice(0, 6)
    const chosenUniverse = resolveBotUniverse(narrative.worldState.setting)

    const botRows = npcs.map((npc, index) => {
      const npcName = sanitizeNpcName(npc.name || '', index)
      const description = clampText(`${npc.role || 'Key player'}. ${npc.publicFace || 'Keeps their cards close.'}`)
      const personalitySections = [
        `Role in Event: ${npc.role || 'Key participant'}`,
        `Motive: ${npc.motive || 'Protect their own interests.'}`,
        `Public Persona: ${npc.publicFace || 'Controlled and observant.'}`,
        npc.hiddenAgenda ? `Hidden Agenda: ${npc.hiddenAgenda}` : null,
        `Initial Relationship Meters: affection=${Math.round(npc.relationship?.affection ?? 50)}, suspicion=${Math.round(npc.relationship?.suspicion ?? 50)}, fear=${Math.round(npc.relationship?.fear ?? 30)}`,
        `World Vibe: ${narrative.worldState.vibe}`,
        `Stakes: ${narrative.worldState.immediateStakes}`,
        `Pressure: ${narrative.worldState.pressure}`,
      ].filter(Boolean)

      return {
        creator_id: user.id,
        name: npcName,
        description,
        personality: clampText(personalitySections.join('\n\n'), 6000),
        universe: chosenUniverse,
        is_published: false,
      }
    })

    const { data: createdBots, error: botCreateError } = await serviceClient()
      .from('bots')
      .insert(botRows)
      .select('id, name')

    if (botCreateError || !createdBots || createdBots.length === 0) {
      return NextResponse.json(
        { error: botCreateError?.message || 'Failed to create AI cast.' },
        { status: 500, headers: rateLimitHeaders(limit) }
      )
    }

    const rulesSections = [
      `Scene Setup: ${narrative.incitingIncident.scene}`,
      `Immediate Stakes: ${narrative.worldState.immediateStakes}`,
      `Pressure: ${narrative.worldState.pressure}`,
      `Tension Clock: ${narrative.director.tensionClock}`,
      `Director Notes: ${narrative.director.sensoryDetails}`,
    ]

    const { data: groupChat, error: groupCreateError } = await serviceClient()
      .from('group_chats')
      .insert({
        name: groupName,
        description: clampText(narrative.director.openingBeat, 500),
        creator_id: user.id,
        visibility,
        max_members: 12,
        group_type: 'roleplay',
        rules: clampText(rulesSections.join('\n\n'), 5000),
        universe: clampText(narrative.worldState.setting, 500),
      })
      .select('id, name')
      .single()

    if (groupCreateError || !groupChat) {
      await serviceClient().from('bots').delete().in('id', createdBots.map((bot) => bot.id)).eq('creator_id', user.id)
      return NextResponse.json(
        { error: groupCreateError?.message || 'Failed to create group chat.' },
        { status: 500, headers: rateLimitHeaders(limit) }
      )
    }

    const { error: membershipError } = await serviceClient().from('group_chat_members').insert({
      group_chat_id: groupChat.id,
      user_id: user.id,
      is_moderator: true,
    })

    if (membershipError) {
      await serviceClient().from('group_chats').delete().eq('id', groupChat.id)
      await serviceClient().from('bots').delete().in('id', createdBots.map((bot) => bot.id)).eq('creator_id', user.id)
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500, headers: rateLimitHeaders(limit) }
      )
    }

    const groupBotLinks = createdBots.map((bot) => ({
      group_chat_id: groupChat.id,
      bot_id: bot.id,
      added_by: user.id,
    }))

    const { error: groupBotsError } = await serviceClient().from('group_chat_bots').insert(groupBotLinks)
    if (groupBotsError) {
      await serviceClient().from('group_chats').delete().eq('id', groupChat.id)
      await serviceClient().from('bots').delete().in('id', createdBots.map((bot) => bot.id)).eq('creator_id', user.id)
      return NextResponse.json(
        { error: groupBotsError.message },
        { status: 500, headers: rateLimitHeaders(limit) }
      )
    }

    const launchMessage = [
      `[Dynamic Event Seed] ${narrative.title}`,
      narrative.incitingIncident.scene,
      `${narrative.dialogueStarter.speaker}: "${narrative.dialogueStarter.line}"`,
      'The AI cast has been created and added to this roleplay group chat.',
    ].join('\n\n')

    await serviceClient().from('group_chat_messages').insert({
      group_chat_id: groupChat.id,
      sender_id: user.id,
      content: clampText(launchMessage, 4000),
    })

    return NextResponse.json(
      {
        groupChatId: groupChat.id,
        groupName: groupChat.name,
        createdBots,
      },
      {
        status: 201,
        headers: rateLimitHeaders(limit),
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
