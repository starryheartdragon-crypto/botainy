import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOpenRouterApiKey, resolveOpenRouterReferer } from '@/lib/openrouterServer'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const svcClient = () => createClient(supabaseUrl, serviceRoleKey)
const anonClient = () => createClient(supabaseUrl, supabaseAnonKey)

async function requireAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const { data: { user }, error } = await anonClient().auth.getUser(token)
  return (!error && user) ? user : null
}

interface TrackScore { score: number }
interface RelationshipTrack {
  name: string
  stages: Array<{ min: number; max: number; label: string }>
}
interface BotMilestone {
  id: string
  track_index: number
  score: number
  name: string
  description: string
}
interface AchievedMilestone {
  milestone_id: string
  achieved_at: string
  track_index: number
  score: number
  name: string
}

const DEFAULT_TRACKS: RelationshipTrack[] = [{
  name: 'Relationship',
  stages: [
    { min: -100, max: -76, label: 'Archrivals' },
    { min: -75, max: -51, label: 'Bitter Enemies' },
    { min: -50, max: -26, label: 'Rivals' },
    { min: -25, max: -11, label: 'Cold Strangers' },
    { min: -10, max: 10, label: 'Neutral' },
    { min: 11, max: 25, label: 'Acquaintances' },
    { min: 26, max: 50, label: 'Friends' },
    { min: 51, max: 75, label: 'Close Friends' },
    { min: 76, max: 90, label: 'Deeply Bonded' },
    { min: 91, max: 99, label: 'Devoted' },
    { min: 100, max: 100, label: 'Lovers' },
  ],
}]

function scoreToStageLabel(score: number, stages: Array<{ min: number; max: number; label: string }>): string {
  return stages.find((s) => score >= s.min && score <= s.max)?.label ?? 'Neutral'
}

async function analyzeSingleBot({
  botId,
  botName,
  personaId,
  groupChatId,
  recentMessages,
  svc,
}: {
  botId: string
  botName: string
  personaId: string
  groupChatId: string
  recentMessages: string
  svc: ReturnType<typeof svcClient>
}): Promise<{ bot_id: string; track_scores: TrackScore[]; milestones_achieved: AchievedMilestone[] }> {
  // Fetch existing relationship row and bot config in parallel
  const [relResult, configResult] = await Promise.all([
    svc
      .from('group_chat_persona_relationships')
      .select('track_scores, milestones_achieved')
      .eq('group_chat_id', groupChatId)
      .eq('persona_id', personaId)
      .eq('bot_id', botId)
      .maybeSingle(),
    svc
      .from('bot_relationship_config')
      .select('tracks, milestones')
      .eq('bot_id', botId)
      .maybeSingle(),
  ])

  const currentTrackScores: TrackScore[] = Array.isArray(relResult.data?.track_scores)
    ? (relResult.data!.track_scores as TrackScore[])
    : []
  const currentMilestones: AchievedMilestone[] = Array.isArray(relResult.data?.milestones_achieved)
    ? (relResult.data!.milestones_achieved as AchievedMilestone[])
    : []

  const tracks: RelationshipTrack[] = Array.isArray(configResult.data?.tracks)
    ? (configResult.data!.tracks as RelationshipTrack[])
    : DEFAULT_TRACKS
  const creatorMilestones: BotMilestone[] = Array.isArray(configResult.data?.milestones)
    ? (configResult.data!.milestones as BotMilestone[])
    : []

  const initializedScores: TrackScore[] = tracks.map((_, i) => ({
    score: currentTrackScores[i]?.score ?? 0,
  }))

  const openrouterApiKey = resolveOpenRouterApiKey()
  let newScores = initializedScores.map((s) => ({ score: s.score }))

  if (openrouterApiKey && recentMessages.trim()) {
    const trackDescriptions = tracks.map((t, i) =>
      `Track ${i} — "${t.name}" (current score ${initializedScores[i].score}, bot: ${botName})`
    ).join('\n')

    const analysisPrompt = `You are a relationship analysis engine for an AI roleplay chatbot app.

Given the recent group chat conversation and current relationship track scores between the user's persona and the bot named "${botName}", determine appropriate score deltas.

RELATIONSHIP TRACKS:
${trackDescriptions}

CONSTRAINTS:
- Each delta must be between -8 and +8
- Only significant emotional interactions with "${botName}" specifically should shift scores
- Neutral or off-topic exchanges should yield 0
- Score is clamped to [-100, 100]

RECENT CONVERSATION (last ~20 messages):
${recentMessages}

Respond ONLY with valid JSON: {"deltas": [${tracks.map(() => '0').join(', ')}]}`

    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterApiKey}`,
          'HTTP-Referer': resolveOpenRouterReferer(),
          'X-Title': 'Botainy',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          temperature: 0.2,
          messages: [{ role: 'user', content: analysisPrompt }],
        }),
      })

      if (resp.ok) {
        const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
        const raw = data?.choices?.[0]?.message?.content?.trim() ?? ''
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { deltas?: unknown[] }
          if (Array.isArray(parsed.deltas)) {
            newScores = initializedScores.map((s, i) => {
              const delta = typeof parsed.deltas![i] === 'number' ? (parsed.deltas![i] as number) : 0
              const clamped = Math.max(-8, Math.min(8, delta))
              return { score: Math.max(-100, Math.min(100, s.score + clamped)) }
            })
          }
        }
      }
    } catch {
      // keep current scores
    }
  }

  // Check for newly crossed milestones
  const newMilestones: AchievedMilestone[] = [...currentMilestones]
  const alreadyAchievedIds = new Set(currentMilestones.map((m) => m.milestone_id))

  for (let i = 0; i < tracks.length; i++) {
    const oldScore = initializedScores[i].score
    const newScore = newScores[i].score
    if (oldScore === newScore) continue

    const oldStage = scoreToStageLabel(oldScore, tracks[i].stages)
    const newStage = scoreToStageLabel(newScore, tracks[i].stages)

    if (oldStage !== newStage) {
      const autoId = `auto_${i}_${newStage.replace(/\s+/g, '_').toLowerCase()}_${botId.slice(0, 8)}`
      if (!alreadyAchievedIds.has(autoId)) {
        newMilestones.push({
          milestone_id: autoId,
          achieved_at: new Date().toISOString(),
          track_index: i,
          score: newScore,
          name: `${botName} — ${tracks[i].name}: ${newStage}`,
        })
        alreadyAchievedIds.add(autoId)
      }
    }
  }

  // Creator-defined milestones
  for (const milestone of creatorMilestones) {
    if (alreadyAchievedIds.has(milestone.id)) continue
    const i = milestone.track_index
    if (i >= newScores.length) continue
    const oldScore = initializedScores[i]?.score ?? 0
    const newScore = newScores[i].score
    const crossed =
      (newScore >= milestone.score && oldScore < milestone.score) ||
      (newScore <= milestone.score && oldScore > milestone.score)
    if (crossed) {
      newMilestones.push({
        milestone_id: milestone.id,
        achieved_at: new Date().toISOString(),
        track_index: i,
        score: newScore,
        name: milestone.name,
      })
      alreadyAchievedIds.add(milestone.id)
    }
  }

  // Upsert the updated row
  await svc
    .from('group_chat_persona_relationships')
    .upsert(
      {
        group_chat_id: groupChatId,
        persona_id: personaId,
        bot_id: botId,
        track_scores: newScores,
        milestones_achieved: newMilestones,
        messages_since_analysis: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_chat_id,persona_id,bot_id' }
    )

  return { bot_id: botId, track_scores: newScores, milestones_achieved: newMilestones }
}

/**
 * POST /api/group-chats/[groupChatId]/relationship/analyze?personaId=xxx
 * Runs AI batch relationship analysis for ALL active bots in the group.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { groupChatId } = await params
    const personaId = req.nextUrl.searchParams.get('personaId')
    if (!personaId) return NextResponse.json({ error: 'personaId required' }, { status: 400 })

    const svc = svcClient()

    // Verify persona belongs to user
    const { data: personaRow } = await svc
      .from('personas')
      .select('id')
      .eq('id', personaId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!personaRow) return NextResponse.json({ error: 'Persona not found' }, { status: 404 })

    // Get active bots
    const { data: botLinks } = await svc
      .from('group_chat_bots')
      .select('bot_id, bots(id, name)')
      .eq('group_chat_id', groupChatId)

    const bots = ((botLinks ?? []) as unknown as Array<{ bot_id: string; bots: { id: string; name: string } | null }>)
      .map((r) => ({ id: r.bot_id, name: r.bots?.name ?? 'Bot' }))
      .filter((b) => b.id)

    if (bots.length === 0) {
      return NextResponse.json({ results: [], skipped: true })
    }

    // Fetch recent messages once and share across all bot analyses
    const { data: recentMsgs } = await svc
      .from('group_chat_messages')
      .select('sender_id, content, created_at')
      .eq('group_chat_id', groupChatId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)

    const recentMessages = ((recentMsgs ?? []) as Array<{ sender_id: string; content: string }>)
      .slice()
      .reverse()
      .map((m) => {
        const isUser = m.sender_id === user.id
        return `${isUser ? 'User' : m.sender_id}: ${m.content}`
      })
      .join('\n')

    // Analyze each bot (sequential to avoid OpenRouter rate limits)
    const results: Array<{ bot_id: string; track_scores: TrackScore[]; milestones_achieved: AchievedMilestone[] }> = []
    for (const bot of bots) {
      const result = await analyzeSingleBot({
        botId: bot.id,
        botName: bot.name,
        personaId,
        groupChatId,
        recentMessages,
        svc,
      })
      results.push(result)
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
