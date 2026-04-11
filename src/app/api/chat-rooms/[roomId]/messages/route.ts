// POST /api/chat-rooms/[roomId]/messages/bot-reply
export async function POST_BOT_REPLY(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomId: rawRoomId } = await params
    const roomId = normalizeRoomId(rawRoomId)
    if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
    const member = await ensureMember(roomId, user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get recent messages for context
    const { data: recentMessages } = await serviceClient()
      .from('chat_room_messages')
      .select('sender_id, content')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(20)

    // Build message history for OpenRouter
    const messageHistory = (recentMessages || []).map((msg) => ({
      role: msg.sender_id === user.id ? 'user' : 'assistant',
      content: msg.content,
    }))

    // Fetch chat room metadata
    const { data: roomMeta, error: roomMetaError } = await serviceClient()
      .from('chat_rooms')
      .select('city_info, universe')
      .eq('id', roomId)
      .maybeSingle()
    if (roomMetaError || !roomMeta) {
      return NextResponse.json({ error: 'Room metadata not found' }, { status: 500 })
    }

    const city = roomMeta.city_info || 'Unknown City'
    const universe = roomMeta.universe || 'Unknown Universe'

    // Example bot selection by universe/city
    // Replace with DB query or config for production
    let cityBots: { name: string; personality: string }[] = []
    if (universe === 'Game of Thrones') {
      if (city === 'Kings Landing') {
        cityBots = [
          { name: 'Tyrion Lannister', personality: 'Clever, witty, politically astute.' },
          { name: 'Petyr Baelish', personality: 'Scheming, manipulative, ambitious.' },
          { name: 'Varys', personality: 'Mysterious, strategic, secretive.' },
        ]
      } else if (city === 'Winterfell') {
        cityBots = [
          { name: 'Jon Snow', personality: 'Honorable, stoic, brave.' },
          { name: 'Sansa Stark', personality: 'Resilient, intelligent, diplomatic.' },
        ]
      }
      // Add more cities/universes as needed
    }

    const moderation = await getModerationFlags(user.id)

    // Build participant list for prompt
    const participantNames = cityBots.map(bot => bot.name).join(', ')
    const hardBoundariesGuardrail = buildHardBoundariesGuardrail(moderation.hardBoundaries)
    const systemPrompt = [
      `You are a bot in the city of ${city}, within the universe of ${universe}.`,
      participantNames ? `The following characters are currently present in this chat room: ${participantNames}.` : '',
      'Respond in character and avoid repeating actions.',
      'Only characters who would be in this city and universe should appear.',
      'If a character is speaking to someone else, do not hijack the conversation. You may react physically or observe, but do not interrupt their dialogue.',
      hardBoundariesGuardrail,
      FOURTH_WALL_MUSIC_GUARDRAIL,
      ABSOLUTE_CONTENT_LIMITS,
    ].filter(Boolean).join('\n\n')

    // OpenRouter API call
    const openrouterApiKey = process.env.OPENROUTER_API_KEY
    const primaryModel = process.env.OPENROUTER_MODEL || 'openrouter/hunter-alpha'
    const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4-turbo'
    if (!openrouterApiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 })
    }

    const makeOpenRouterCall = async (model: string) =>
      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterApiKey}`,
          'HTTP-Referer': 'https://botainy.com',
          'X-Title': 'Botainy',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messageHistory,
          ],
          temperature: 0.85,
          frequency_penalty: 0.4,
          presence_penalty: 0.4,
        }),
      })

    let openrouterResp = await makeOpenRouterCall(primaryModel)
    if (!openrouterResp.ok) {
      console.warn(`Primary model (${primaryModel}) failed, retrying with fallback (${fallbackModel})`)
      openrouterResp = await makeOpenRouterCall(fallbackModel)
    }

    const openrouterData = await openrouterResp.json().catch(() => null)
    if (!openrouterResp.ok) {
      return NextResponse.json({ error: 'OpenRouter error', details: openrouterData }, { status: 500 })
    }

    const botReply = openrouterData?.choices?.[0]?.message?.content || 'Bot reply unavailable.'
    return NextResponse.json({ botReply })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ABSOLUTE_CONTENT_LIMITS, buildHardBoundariesGuardrail, FOURTH_WALL_MUSIC_GUARDRAIL } from '@/lib/roleplayFormatting'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NEW_YORK_TIMEZONE = 'America/New_York'

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null
  return UUID_REGEX.test(trimmed) ? trimmed : null
}

function normalizePersonaId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null
  return trimmed
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || '0')

  return {
    year: valueOf('year'),
    month: valueOf('month'),
    day: valueOf('day'),
    hour: valueOf('hour'),
    minute: valueOf('minute'),
    second: valueOf('second'),
  }
}

function zonedTimeToUtc(timeZone: string, dateParts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}) {
  let guess = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    dateParts.hour,
    dateParts.minute,
    dateParts.second
  )

  for (let i = 0; i < 3; i += 1) {
    const observed = getZonedDateParts(new Date(guess), timeZone)
    const desiredAsUtc = Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      dateParts.hour,
      dateParts.minute,
      dateParts.second
    )
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    )

    const diff = desiredAsUtc - observedAsUtc
    guess += diff

    if (Math.abs(diff) < 1000) break
  }

  return new Date(guess)
}

function getCurrentCycleStartIso() {
  const nowNy = getZonedDateParts(new Date(), NEW_YORK_TIMEZONE)
  const cycleHour = Math.floor(nowNy.hour / 6) * 6

  const startUtc = zonedTimeToUtc(NEW_YORK_TIMEZONE, {
    year: nowNy.year,
    month: nowNy.month,
    day: nowNy.day,
    hour: cycleHour,
    minute: 0,
    second: 0,
  })

  return startUtc.toISOString()
}

async function clearExpiredRoomMessages(roomId: string) {
  const cycleStartIso = getCurrentCycleStartIso()

  const { error } = await serviceClient()
    .from('chat_room_messages')
    .delete()
    .eq('room_id', roomId)
    .lt('created_at', cycleStartIso)

  if (error) {
    throw new Error(error.message)
  }
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const { data: { user }, error } = await authClient().auth.getUser(token)
  if (error || !user) return null
  return user
}

async function ensureMember(roomId: string, userId: string) {
  const { data, error } = await serviceClient()
    .from('chat_room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return !!data
}

async function getModerationFlags(userId: string) {
  const { data, error } = await serviceClient()
    .from('users')
    .select('is_banned, is_silenced, hard_boundaries')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return {
    isBanned: !!data?.is_banned,
    isSilenced: !!data?.is_silenced,
    hardBoundaries: (data as { hard_boundaries?: string[] } | null)?.hard_boundaries ?? [],
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomId: rawRoomId } = await params
    const roomId = normalizeRoomId(rawRoomId)
    if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
    const member = await ensureMember(roomId, user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await clearExpiredRoomMessages(roomId)

    const { data, error } = await serviceClient()
      .from('chat_room_messages')
      .select('id, room_id, sender_id, persona_id, content, created_at, updated_at, personas(id, name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data || [])
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const moderation = await getModerationFlags(user.id)
    if (moderation.isBanned) {
      return NextResponse.json({ error: 'You are banned from chat rooms' }, { status: 403 })
    }

    if (moderation.isSilenced) {
      return NextResponse.json({ error: 'You are silenced and cannot send chat room messages' }, { status: 403 })
    }

    const { roomId: rawRoomId } = await params
    const roomId = normalizeRoomId(rawRoomId)
    if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 })
    const member = await ensureMember(roomId, user.id)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await clearExpiredRoomMessages(roomId)

    const body = await req.json()
    const content = String(body?.content || '').trim()
    const personaId = normalizePersonaId(body?.personaId)
    if (!content) return NextResponse.json({ error: 'Message content required' }, { status: 400 })

    if (personaId && !UUID_REGEX.test(personaId)) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
    }

    if (personaId) {
      const { data: persona, error: personaError } = await serviceClient()
        .from('personas')
        .select('id')
        .eq('id', personaId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (personaError || !persona) {
        return NextResponse.json({ error: 'Invalid persona' }, { status: 400 })
      }
    }

    const { data, error } = await serviceClient()
      .from('chat_room_messages')
      .insert({ room_id: roomId, sender_id: user.id, persona_id: personaId, content })
      .select('id, room_id, sender_id, persona_id, content, created_at, updated_at, personas(id, name, avatar_url)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
