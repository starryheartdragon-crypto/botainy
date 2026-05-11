import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOpenRouterApiKey, resolveOpenRouterReferer } from '@/lib/openrouterServer'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

interface TrackScore { score: number }
interface RelationshipTrack { name: string; stages: Array<{ min: number; max: number; label: string }> }
interface BotMilestone { id: string; track_index: number; score: number; name: string; description: string }
interface AchievedMilestone { milestone_id: string; achieved_at: string; track_index: number; score: number; name: string }

function scoreToStageLabel(score: number, stages: Array<{ min: number; max: number; label: string }>): string {
  const stage = stages.find((s) => score >= s.min && score <= s.max)
  return stage?.label ?? 'Neutral'
}

// POST /api/chats/[chatId]/relationship/analyze?personaId=xxx
// Called by the client every N bot replies to run AI batch score analysis.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chatId } = await params
    const personaId = req.nextUrl.searchParams.get('personaId')
    if (!personaId) return NextResponse.json({ error: 'personaId is required' }, { status: 400 })

    const service = getServiceClient()

    // Verify ownership and get bot_id
    const { data: chat } = await service
      .from('chats')
      .select('id, user_id, bot_id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    // Fetch current relationship row + bot config in parallel
    const [relResult, configResult, recentMsgsResult] = await Promise.all([
      service
        .from('chat_persona_relationships')
        .select('track_scores, milestones_achieved, relationship_score, relationship_tags, relationship_summary')
        .eq('chat_id', chatId)
        .eq('persona_id', personaId)
        .maybeSingle(),
      service
        .from('bot_relationship_config')
        .select('tracks, milestones, batch_every')
        .eq('bot_id', chat.bot_id)
        .maybeSingle(),
      service
        .from('chat_messages')
        .select('sender_id, content, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const currentTrackScores: TrackScore[] = Array.isArray(relResult.data?.track_scores)
      ? (relResult.data.track_scores as TrackScore[])
      : []
    const currentMilestones: AchievedMilestone[] = Array.isArray(relResult.data?.milestones_achieved)
      ? (relResult.data.milestones_achieved as AchievedMilestone[])
      : []

    const tracks: RelationshipTrack[] = Array.isArray(configResult.data?.tracks)
      ? (configResult.data.tracks as RelationshipTrack[])
      : [{ name: 'Relationship', stages: [{ min: -100, max: -76, label: 'Archrivals' }, { min: -75, max: -51, label: 'Bitter Enemies' }, { min: -50, max: -26, label: 'Rivals' }, { min: -25, max: -11, label: 'Cold Strangers' }, { min: -10, max: 10, label: 'Neutral' }, { min: 11, max: 25, label: 'Acquaintances' }, { min: 26, max: 50, label: 'Friends' }, { min: 51, max: 75, label: 'Close Friends' }, { min: 76, max: 90, label: 'Deeply Bonded' }, { min: 91, max: 99, label: 'Devoted' }, { min: 100, max: 100, label: 'Lovers' }] }]
    const creatorMilestones: BotMilestone[] = Array.isArray(configResult.data?.milestones)
      ? (configResult.data.milestones as BotMilestone[])
      : []

    // Ensure track_scores array has an entry for every track
    const initializedScores: TrackScore[] = tracks.map((_, i) => ({
      score: currentTrackScores[i]?.score ?? 0,
    }))

    // Get recent messages in chronological order
    const recentMessages = (recentMsgsResult.data ?? [])
      .reverse()
      .map((m) => `${m.sender_id === user.id ? 'User' : 'Bot'}: ${m.content}`)
      .join('\n')

    if (!recentMessages.trim()) {
      return NextResponse.json({ track_scores: initializedScores, milestones_achieved: currentMilestones, skipped: true })
    }

    const openrouterApiKey = resolveOpenRouterApiKey()
    if (!openrouterApiKey) {
      return NextResponse.json({ error: 'OpenRouter not configured' }, { status: 500 })
    }

    // Build the analysis prompt
    const trackDescriptions = tracks.map((t, i) =>
      `Track ${i} — "${t.name}": current score ${initializedScores[i].score}`
    ).join('\n')

    const analysisPrompt = `You are a relationship analysis engine for an AI roleplay chatbot app.

Given the recent conversation excerpt and the current relationship track scores, determine appropriate score deltas.

RELATIONSHIP TRACKS:
${trackDescriptions}

CONSTRAINTS:
- Each delta must be between -8 and +8 (max ±8 per batch analysis)
- Be conservative — only significant emotional moments warrant large changes
- Neutral/boring exchanges should yield 0 change
- The score is clamped to [-100, 100]

RECENT CONVERSATION (last ~20 messages):
${recentMessages}

Respond ONLY with valid JSON in this exact format (one entry per track in order):
{"deltas": [${tracks.map(() => '0').join(', ')}]}`

    let newScores = initializedScores.map((s) => ({ score: s.score }))

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
        // Extract JSON even if wrapped in markdown
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { deltas?: unknown[] }
          if (Array.isArray(parsed.deltas)) {
            newScores = initializedScores.map((s, i) => {
              const delta = typeof parsed.deltas![i] === 'number' ? parsed.deltas![i] as number : 0
              const clamped = Math.max(-8, Math.min(8, delta))
              return { score: Math.max(-100, Math.min(100, s.score + clamped)) }
            })
          }
        }
      }
    } catch {
      // Analysis failed — keep current scores, still reset counter
    }

    // Check for newly crossed milestones
    const newMilestones: AchievedMilestone[] = [...currentMilestones]
    const alreadyAchievedIds = new Set(currentMilestones.map((m) => m.milestone_id))

    // Stage-crossing auto milestones
    for (let i = 0; i < tracks.length; i++) {
      const oldScore = initializedScores[i].score
      const newScore = newScores[i].score
      if (oldScore === newScore) continue

      const oldStage = scoreToStageLabel(oldScore, tracks[i].stages)
      const newStage = scoreToStageLabel(newScore, tracks[i].stages)

      if (oldStage !== newStage) {
        const autoId = `auto_${i}_${newStage.replace(/\s+/g, '_').toLowerCase()}`
        if (!alreadyAchievedIds.has(autoId)) {
          newMilestones.push({
            milestone_id: autoId,
            achieved_at: new Date().toISOString(),
            track_index: i,
            score: newScore,
            name: `${tracks[i].name}: ${newStage}`,
          })
          alreadyAchievedIds.add(autoId)
        }
      }
    }

    // Creator-defined milestones
    for (const m of creatorMilestones) {
      if (alreadyAchievedIds.has(m.id)) continue
      const oldScore = initializedScores[m.track_index]?.score ?? 0
      const newScore = newScores[m.track_index]?.score ?? 0
      const crossed = (oldScore < m.score && newScore >= m.score) || (oldScore > m.score && newScore <= m.score)
      if (crossed) {
        newMilestones.push({
          milestone_id: m.id,
          achieved_at: new Date().toISOString(),
          track_index: m.track_index,
          score: newScore,
          name: m.name,
        })
        alreadyAchievedIds.add(m.id)
      }
    }

    // Upsert the relationship row with updated scores and milestones
    const { error: upsertError } = await service
      .from('chat_persona_relationships')
      .upsert(
        {
          chat_id: chatId,
          persona_id: personaId,
          track_scores: newScores,
          milestones_achieved: newMilestones,
          messages_since_analysis: 0,
        },
        { onConflict: 'chat_id,persona_id' }
      )

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

    return NextResponse.json({
      track_scores: newScores,
      milestones_achieved: newMilestones,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
