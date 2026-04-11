import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BOT_UNIVERSES } from '@/lib/botUniverses'
import { getSharedPrivateBotIdsForUser } from '@/lib/botVisibility'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type ExampleDialogue = { user: string; bot: string }

type CreateBotPayload = {
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
  sourceExcerpts?: string | null
  exampleDialogues?: ExampleDialogue[] | null
  characterQuotes?: string[] | null
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope')?.trim() || ''
    const nameQuery = searchParams.get('name')?.trim() || ''
    const universeQuery = searchParams.get('universe')?.trim() || ''

    if (scope === 'mine') {
      const authHeader = req.headers.get('authorization')
      const { user, error: authError } = await getUserFromAuthHeader(authHeader)

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
      let mineQuery = serviceClient()
      .from('bots')
        .select('id,name,universe,description,personality,avatar_url,is_published,created_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })

      if (nameQuery) {
        mineQuery = mineQuery.ilike('name', `%${nameQuery}%`)
      }

      if (universeQuery) {
        if (!BOT_UNIVERSES.includes(universeQuery as (typeof BOT_UNIVERSES)[number])) {
          return NextResponse.json({ error: 'Invalid bot universe' }, { status: 400 })
        }
        mineQuery = mineQuery.eq('universe', universeQuery)
      }

      const { data, error } = await mineQuery

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ bots: data ?? [] }, { status: 200 })
    }

    if (universeQuery && !BOT_UNIVERSES.includes(universeQuery as (typeof BOT_UNIVERSES)[number])) {
      return NextResponse.json({ error: 'Invalid bot universe' }, { status: 400 })
    }

    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
    let query = serviceClient()
      .from('bots')
      .select('id,name,description,personality,avatar_url,creator_id,universe,is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (nameQuery) {
      query = query.ilike('name', `%${nameQuery}%`)
    }

    if (universeQuery) {
      query = query.eq('universe', universeQuery)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const publicBots = data ?? []
    const authHeader = req.headers.get('authorization')
    const { user } = await getUserFromAuthHeader(authHeader)

    if (!user) {
      const sanitizedPublicBots = publicBots.map(({ is_published, ...bot }) => bot)
      return NextResponse.json({ bots: sanitizedPublicBots }, { status: 200 })
    }

    const sharedPrivateBotIds = await getSharedPrivateBotIdsForUser(serviceClient(), user.id)

    let privateBotsQuery = serviceClient()
      .from('bots')
      .select('id,name,description,personality,avatar_url,creator_id,universe,is_published')
      .eq('is_published', false)
      .in('id', Array.from(sharedPrivateBotIds))
      .order('created_at', { ascending: false })
      .limit(100)

    if (nameQuery) {
      privateBotsQuery = privateBotsQuery.ilike('name', `%${nameQuery}%`)
    }

    if (universeQuery) {
      privateBotsQuery = privateBotsQuery.eq('universe', universeQuery)
    }

    const { data: privateBots, error: privateBotsError } =
      sharedPrivateBotIds.size > 0
        ? await privateBotsQuery
        : { data: [], error: null }

    if (privateBotsError) {
      return NextResponse.json({ error: privateBotsError.message }, { status: 500 })
    }

    const merged = [...publicBots, ...(privateBots ?? [])]
    const uniqueBots = Array.from(new Map(merged.map((bot) => [bot.id, bot])).values())
    const sanitizedBots = uniqueBots.map(({ is_published, ...bot }) => bot)

    return NextResponse.json({ bots: sanitizedBots }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load bots'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const { user, error: authError } = await getUserFromAuthHeader(authHeader)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as CreateBotPayload
    const name = body.name?.trim() || ''
    const description = body.description?.trim() || ''
    const personality = body.personality?.trim() || ''
    const backstory = body.backstory?.trim() || ''
    const goals = body.goals?.trim() || ''
    const scenario = body.scenario?.trim() || ''
    const rules = body.rules?.trim() || ''
    const style = body.style?.trim() || ''
    const greeting = body.greeting?.trim() || ''
    const characterProfile = body.characterProfile?.trim() || ''
    const universe = body.universe?.trim() || ''
    const avatarUrl = body.avatarUrl ?? null
    const isPublished = Boolean(body.isPublished)
    const sourceExcerpts = typeof body.sourceExcerpts === 'string' ? body.sourceExcerpts.trim().slice(0, 6000) || null : null
    const exampleDialogues = Array.isArray(body.exampleDialogues)
      ? body.exampleDialogues.slice(0, 8).filter(
          (d): d is ExampleDialogue =>
            d !== null &&
            typeof d === 'object' &&
            typeof (d as ExampleDialogue).user === 'string' &&
            typeof (d as ExampleDialogue).bot === 'string'
        )
      : null
    const characterQuotes = Array.isArray(body.characterQuotes)
      ? (body.characterQuotes as unknown[]).filter((q): q is string => typeof q === 'string').slice(0, 10)
      : null

    if (!name || !description || !personality || !universe) {
      return NextResponse.json(
        { error: 'Bot name, description, personality, and universe are required' },
        { status: 400 }
      )
    }

    if (!BOT_UNIVERSES.includes(universe as (typeof BOT_UNIVERSES)[number])) {
      return NextResponse.json({ error: 'Invalid bot universe' }, { status: 400 })
    }

    const assembledPersonalitySections = [
      personality ? `Core Personality: ${personality}` : null,
      backstory ? `Backstory: ${backstory}` : null,
      goals ? `Goals & Motivations: ${goals}` : null,
      scenario ? `Preferred Scenario: ${scenario}` : null,
      rules ? `Rules / Boundaries: ${rules}` : null,
      style ? `Speaking Style: ${style}` : null,
      greeting ? `Suggested Greeting: ${greeting}` : null,
    ].filter(Boolean)

    const finalPersonality =
      assembledPersonalitySections.length > 0
        ? assembledPersonalitySections.join('\n\n')
        : characterProfile || personality

    const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await serviceClient()
      .from('bots')
      .insert({
        creator_id: user.id,
        name,
        description,
        personality: finalPersonality,
        universe,
        avatar_url: avatarUrl,
        is_published: isPublished,
        source_excerpts: sourceExcerpts,
        example_dialogues: exampleDialogues && exampleDialogues.length > 0 ? exampleDialogues : null,
        character_quotes: characterQuotes && characterQuotes.length > 0 ? characterQuotes : null,
      })
      .select('id,is_published')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bot: data }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create bot'
    return NextResponse.json({ error: message }, { status: 500 })
  }
 }
