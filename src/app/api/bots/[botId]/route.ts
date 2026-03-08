import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BOT_UNIVERSES } from '@/lib/botUniverses'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type UpdateBotPayload = {
  name?: string
  description?: string
  personality?: string
  backstory?: string
  goals?: string
  scenario?: string
  rules?: string
  style?: string
  greeting?: string
  characterProfile?: string
  universe?: string
  avatarUrl?: string | null
  isPublished?: boolean
}

async function getUserFromAuthHeader(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return { user: null, error: 'Unauthorized' }
  }

  const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Unauthorized' }
  }

  return { user, error: null }
}

function normalizePublishedFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }
  return false
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as UpdateBotPayload

    const updateData: {
      name?: string
      description?: string
      personality?: string
      universe?: string
      avatar_url?: string | null
      is_published?: boolean
    } = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'Bot name cannot be empty' }, { status: 400 })
      }
      updateData.name = name
    }

    if (typeof body.description === 'string') {
      const description = body.description.trim()
      if (!description) {
        return NextResponse.json({ error: 'Bot description cannot be empty' }, { status: 400 })
      }
      updateData.description = description
    }

    const hasProfileUpdate = [
      'personality',
      'backstory',
      'goals',
      'scenario',
      'rules',
      'style',
      'greeting',
      'characterProfile',
    ].some((field) => Object.prototype.hasOwnProperty.call(body, field))

    if (hasProfileUpdate) {
      const personality = typeof body.personality === 'string' ? body.personality.trim() : undefined
      const backstory = typeof body.backstory === 'string' ? body.backstory.trim() : undefined
      const goals = typeof body.goals === 'string' ? body.goals.trim() : undefined
      const scenario = typeof body.scenario === 'string' ? body.scenario.trim() : undefined
      const rules = typeof body.rules === 'string' ? body.rules.trim() : undefined
      const style = typeof body.style === 'string' ? body.style.trim() : undefined
      const greeting = typeof body.greeting === 'string' ? body.greeting.trim() : undefined
      const characterProfile =
        typeof body.characterProfile === 'string' ? body.characterProfile.trim() : undefined

      if (personality !== undefined && !personality) {
        return NextResponse.json({ error: 'Bot personality cannot be empty' }, { status: 400 })
      }

      const personalitySections = [
        personality ? `Core Personality: ${personality}` : null,
        backstory ? `Backstory: ${backstory}` : null,
        goals ? `Goals & Motivations: ${goals}` : null,
        scenario ? `Preferred Scenario: ${scenario}` : null,
        rules ? `Rules / Boundaries: ${rules}` : null,
        style ? `Speaking Style: ${style}` : null,
        greeting ? `Suggested Greeting: ${greeting}` : null,
      ].filter(Boolean)

      const finalPersonality =
        personalitySections.length > 0
          ? personalitySections.join('\n\n')
          : characterProfile || personality

      if (!finalPersonality) {
        return NextResponse.json({ error: 'Bot personality cannot be empty' }, { status: 400 })
      }

      updateData.personality = finalPersonality
    }

    if (typeof body.universe === 'string') {
      const universe = body.universe.trim()
      if (!universe) {
        return NextResponse.json({ error: 'Bot universe cannot be empty' }, { status: 400 })
      }
      if (!BOT_UNIVERSES.includes(universe as (typeof BOT_UNIVERSES)[number])) {
        return NextResponse.json({ error: 'Invalid bot universe' }, { status: 400 })
      }
      updateData.universe = universe
    }

    if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
      updateData.avatar_url = body.avatarUrl ?? null
    }

    if (typeof body.isPublished === 'boolean') {
      updateData.is_published = body.isPublished
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 })
    }

    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await serviceClient()
      .from('bots')
      .update(updateData)
      .eq('id', botId)
      .eq('creator_id', user.id)
      .select('id,name,description,personality,universe,avatar_url,is_published')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    return NextResponse.json({ bot: data }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update bot'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

    const { data: existingBot, error: existingBotError } = await serviceClient()
      .from('bots')
      .select('id,is_published')
      .eq('id', botId)
      .eq('creator_id', user.id)
      .single()

    if (existingBotError || !existingBot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    if (normalizePublishedFlag(existingBot.is_published)) {
      return NextResponse.json(
        { error: 'Only private bots and drafts can be deleted' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await serviceClient()
      .from('bots')
      .delete()
      .eq('id', botId)
      .eq('creator_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete bot'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
