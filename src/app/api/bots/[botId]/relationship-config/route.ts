import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface RelationshipStage {
  min: number   // inclusive, -100 to 100
  max: number   // inclusive, -100 to 100
  label: string
  color: string
}

export interface RelationshipThreshold {
  score: number        // when track score crosses this value
  above: boolean       // true = fires when score goes above; false = below
  instruction: string  // injected into system prompt when active
}

export interface RelationshipTrack {
  name: string                     // e.g. "Trust", "Romantic Tension"
  arc_preset: string | null        // e.g. "romance", "rivalry", "mentor"
  stages: RelationshipStage[]      // 5-11 stages covering -100 to +100
  thresholds: RelationshipThreshold[]
}

export interface BotRelationshipConfig {
  tracks: RelationshipTrack[]
  milestones: BotMilestone[]
  batch_every: 3 | 5 | 10
}

export interface BotMilestone {
  id: string
  track_index: number
  score: number
  name: string
  description: string
}

// Arc preset → default stages
export const ARC_PRESETS: Record<string, RelationshipStage[]> = {
  romance: [
    { min: -100, max: -51, label: 'Heartbreak', color: '#ef4444' },
    { min: -50, max: -26, label: 'Resentment', color: '#f97316' },
    { min: -25, max: -1, label: 'Distant', color: '#9ca3af' },
    { min: 0, max: 25, label: 'Curious', color: '#93c5fd' },
    { min: 26, max: 50, label: 'Interested', color: '#60a5fa' },
    { min: 51, max: 75, label: 'Infatuated', color: '#c084fc' },
    { min: 76, max: 90, label: 'Devoted', color: '#f472b6' },
    { min: 91, max: 100, label: 'Lovers', color: '#ec4899' },
  ],
  rivalry: [
    { min: -100, max: -76, label: 'Arch-Nemesis', color: '#ef4444' },
    { min: -75, max: -51, label: 'Bitter Rivals', color: '#f97316' },
    { min: -50, max: -26, label: 'Rivals', color: '#fb923c' },
    { min: -25, max: -1, label: 'Competitive', color: '#fbbf24' },
    { min: 0, max: 25, label: 'Wary', color: '#d1d5db' },
    { min: 26, max: 50, label: 'Respected', color: '#93c5fd' },
    { min: 51, max: 75, label: 'Frenemies', color: '#a78bfa' },
    { min: 76, max: 100, label: 'Worthy Ally', color: '#34d399' },
  ],
  mentor: [
    { min: -100, max: -51, label: 'Disappointed', color: '#ef4444' },
    { min: -50, max: -26, label: 'Doubtful', color: '#f97316' },
    { min: -25, max: -1, label: 'Skeptical', color: '#9ca3af' },
    { min: 0, max: 25, label: 'Watchful', color: '#d1d5db' },
    { min: 26, max: 50, label: 'Encouraging', color: '#93c5fd' },
    { min: 51, max: 75, label: 'Proud', color: '#60a5fa' },
    { min: 76, max: 90, label: 'Trusted', color: '#a78bfa' },
    { min: 91, max: 100, label: 'Legacy Bond', color: '#c084fc' },
  ],
  'found-family': [
    { min: -100, max: -51, label: 'Estranged', color: '#ef4444' },
    { min: -50, max: -26, label: 'At Odds', color: '#f97316' },
    { min: -25, max: -1, label: 'Uneasy', color: '#9ca3af' },
    { min: 0, max: 25, label: 'Acquainted', color: '#d1d5db' },
    { min: 26, max: 50, label: 'Crew', color: '#93c5fd' },
    { min: 51, max: 75, label: 'Family', color: '#60a5fa' },
    { min: 76, max: 90, label: 'Chosen Family', color: '#a78bfa' },
    { min: 91, max: 100, label: 'Unbreakable', color: '#f472b6' },
  ],
  default: [
    { min: -100, max: -76, label: 'Archrivals', color: '#ef4444' },
    { min: -75, max: -51, label: 'Bitter Enemies', color: '#f97316' },
    { min: -50, max: -26, label: 'Rivals', color: '#fb923c' },
    { min: -25, max: -11, label: 'Cold Strangers', color: '#9ca3af' },
    { min: -10, max: 10, label: 'Neutral', color: '#d1d5db' },
    { min: 11, max: 25, label: 'Acquaintances', color: '#93c5fd' },
    { min: 26, max: 50, label: 'Friends', color: '#60a5fa' },
    { min: 51, max: 75, label: 'Close Friends', color: '#a78bfa' },
    { min: 76, max: 90, label: 'Deeply Bonded', color: '#c084fc' },
    { min: 91, max: 99, label: 'Devoted', color: '#f472b6' },
    { min: 100, max: 100, label: 'Lovers', color: '#ec4899' },
  ],
}

function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey)
}

function getAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

async function requireAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const { data: { user }, error } = await getAnonClient().auth.getUser(token)
  return (!error && user) ? user : null
}

async function requireBotOwner(service: ReturnType<typeof getServiceClient>, botId: string, userId: string) {
  const { data } = await service.from('bots').select('id').eq('id', botId).eq('creator_id', userId).maybeSingle()
  return !!data
}

function validateConfig(config: unknown): { valid: boolean; error?: string } {
  if (!config || typeof config !== 'object') return { valid: false, error: 'Config must be an object' }
  const c = config as Record<string, unknown>

  if (!Array.isArray(c.tracks)) return { valid: false, error: 'tracks must be an array' }
  if (c.tracks.length > 3) return { valid: false, error: 'Maximum 3 tracks allowed' }

  for (const track of c.tracks as unknown[]) {
    if (!track || typeof track !== 'object') return { valid: false, error: 'Each track must be an object' }
    const t = track as Record<string, unknown>
    if (typeof t.name !== 'string' || !t.name.trim()) return { valid: false, error: 'Track name required' }
    if (!Array.isArray(t.stages) || t.stages.length === 0) return { valid: false, error: 'Track stages required' }
    if (!Array.isArray(t.thresholds)) return { valid: false, error: 'Track thresholds must be an array' }
    if (t.thresholds.length > 10) return { valid: false, error: 'Max 10 thresholds per track' }
  }

  if (!Array.isArray(c.milestones)) return { valid: false, error: 'milestones must be an array' }
  if (c.milestones.length > 20) return { valid: false, error: 'Max 20 milestones per bot' }

  const batchEvery = c.batch_every
  if (batchEvery !== 3 && batchEvery !== 5 && batchEvery !== 10) {
    return { valid: false, error: 'batch_every must be 3, 5, or 10' }
  }

  return { valid: true }
}

// GET /api/bots/[botId]/relationship-config
// Public — anyone reading a chat needs the config
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params
    const service = getServiceClient()

    const { data, error } = await service
      .from('bot_relationship_config')
      .select('tracks, milestones, batch_every')
      .eq('bot_id', botId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!data) {
      // Return a sensible default — single "Relationship" track with the default arc
      const defaultConfig: BotRelationshipConfig = {
        tracks: [{ name: 'Relationship', arc_preset: 'default', stages: ARC_PRESETS.default, thresholds: [] }],
        milestones: [],
        batch_every: 5,
      }
      return NextResponse.json(defaultConfig)
    }

    return NextResponse.json({
      tracks: data.tracks ?? [],
      milestones: data.milestones ?? [],
      batch_every: data.batch_every ?? 5,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// PUT /api/bots/[botId]/relationship-config
// Bot creator only — upserts the full config
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { botId } = await params
    const service = getServiceClient()

    if (!(await requireBotOwner(service, botId, user.id))) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const body = await req.json()
    const validation = validateConfig(body)
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 })

    const config = body as BotRelationshipConfig

    const { error } = await service
      .from('bot_relationship_config')
      .upsert(
        {
          bot_id: botId,
          tracks: config.tracks,
          milestones: config.milestones,
          batch_every: config.batch_every,
        },
        { onConflict: 'bot_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
