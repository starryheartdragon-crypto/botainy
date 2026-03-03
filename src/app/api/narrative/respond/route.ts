import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromHeaders, rateLimitHeaders } from '@/lib/rateLimit'

type Relationship = {
  affection: number
  suspicion: number
  fear: number
}

type RelationshipMeters = Record<string, Relationship>

type NarrativeNpc = {
  name: string
  role: string
  motive: string
  publicFace: string
  hiddenAgenda?: string
  relationship: Relationship
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
  sceneCardPrompt: string
}

type ChatHistoryEntry = {
  speaker: string
  text: string
  role: 'user' | 'director' | 'npc'
}

type NarrativeTurnResponse = {
  directorText: string
  npcReplies: Array<{ name: string; line: string }>
  nextSituation: string
  relationshipEffects: Record<string, { affection?: number; suspicion?: number; fear?: number }>
  updatedTensionClock: string
  sceneCardPrompt?: string
}

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampShift(value: number) {
  return Math.max(-15, Math.min(15, Math.round(value)))
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    const fenced = value.match(/```json\s*([\s\S]*?)```/i)
    if (!fenced) return null
    try {
      return JSON.parse(fenced[1]) as T
    } catch {
      return null
    }
  }
}

function normalizeTurnResponse(
  payload: Partial<NarrativeTurnResponse>,
  fallbackNpcName: string
): NarrativeTurnResponse {
  const npcRepliesRaw = Array.isArray(payload.npcReplies) ? payload.npcReplies : []
  const npcReplies = npcRepliesRaw
    .slice(0, 2)
    .map((entry) => ({
      name: entry?.name?.trim() || fallbackNpcName,
      line: entry?.line?.trim() || '“I am watching your next move carefully.”',
    }))

  const effectsRaw = payload.relationshipEffects ?? {}
  const relationshipEffects: Record<string, { affection?: number; suspicion?: number; fear?: number }> = {}

  for (const [name, shifts] of Object.entries(effectsRaw)) {
    relationshipEffects[name] = {
      affection: shifts?.affection === undefined ? undefined : clampShift(shifts.affection),
      suspicion: shifts?.suspicion === undefined ? undefined : clampShift(shifts.suspicion),
      fear: shifts?.fear === undefined ? undefined : clampShift(shifts.fear),
    }
  }

  return {
    directorText:
      payload.directorText?.trim() ||
      'The room tightens around your words, and every witness starts recalculating loyalties.',
    npcReplies: npcReplies.length > 0 ? npcReplies : [{ name: fallbackNpcName, line: '“Then speak plainly. What is your command?”' }],
    nextSituation:
      payload.nextSituation?.trim() ||
      'A new detail surfaces that could either expose the conspirators or implicate an ally.',
    relationshipEffects,
    updatedTensionClock: payload.updatedTensionClock?.trim() || 'Clock advancing',
    sceneCardPrompt: payload.sceneCardPrompt?.trim() || undefined,
  }
}

export async function POST(req: Request) {
  try {
    const limit = checkRateLimit({
      bucket: 'narrative-respond',
      key: getClientIpFromHeaders(req.headers),
      max: 30,
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

    const { narrative, relationshipMeters, userResponse, history } = (await req.json()) as {
      narrative?: NarrativePayload
      relationshipMeters?: RelationshipMeters
      userResponse?: string
      history?: ChatHistoryEntry[]
    }

    if (!narrative || !userResponse?.trim()) {
      return NextResponse.json({ error: 'Narrative context and in-character response are required.' }, { status: 400 })
    }

    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      const fallbackNpc = narrative.npcs[0]?.name || 'Advisor'
      return NextResponse.json(
        {
          turn: normalizeTurnResponse(
            {
              directorText:
                'Your statement echoes through the chamber; eyes shift, and silence turns strategic.',
              npcReplies: [{ name: fallbackNpc, line: '“Your move forces our enemies to react tonight.”' }],
              nextSituation: 'A sealed ledger is brought forward, marked with the crest of a trusted house.',
              relationshipEffects: { [fallbackNpc]: { affection: 2, suspicion: -1, fear: 0 } },
              updatedTensionClock: 'One step closer to dawn',
            },
            fallbackNpc
          ),
        },
        { headers: rateLimitHeaders(limit) }
      )
    }

    const npcSummary = narrative.npcs
      .map((npc) => {
        const meters = relationshipMeters?.[npc.name] || npc.relationship
        return `${npc.name} (${npc.role}) motive=${npc.motive}; publicFace=${npc.publicFace}; affection=${clampMeter(
          meters.affection
        )}, suspicion=${clampMeter(meters.suspicion)}, fear=${clampMeter(meters.fear)}`
      })
      .join('\n')

    const recentHistory = Array.isArray(history) ? history.slice(-8) : []
    const historyText = recentHistory
      .map((entry) => `${entry.role.toUpperCase()} ${entry.speaker}: ${entry.text}`)
      .join('\n')

    const systemPrompt = `You are a Director + NPC engine for immersive roleplay turns.
The user writes in-character actions/dialogue. Continue the world response without speaking as the user.
Return ONLY JSON:
{
  "directorText": string,
  "npcReplies": [{ "name": string, "line": string }],
  "nextSituation": string,
  "relationshipEffects": {
    "<npc name>": { "affection": number, "suspicion": number, "fear": number }
  },
  "updatedTensionClock": string,
  "sceneCardPrompt": string
}
Rules:
- directorText must describe environment + consequences of user action.
- npcReplies should include 1-2 brief spoken lines.
- relationshipEffects are small shifts in range -6..6.
- Keep tone and setting continuity.
- Never write the user's dialogue or actions.
- No markdown.`

    const userPrompt = `Scenario: ${narrative.title}
Setting: ${narrative.worldState.setting}
Vibe: ${narrative.worldState.vibe}
Stakes: ${narrative.worldState.immediateStakes}
Pressure: ${narrative.worldState.pressure}
Current Tension Clock: ${narrative.director.tensionClock}
Inciting Incident: ${narrative.incitingIncident.scene}

NPC STATE:
${npcSummary}

RECENT TRANSCRIPT:
${historyText || 'No prior turns'}

USER IN-CHARACTER RESPONSE:
${userResponse.trim()}`

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content

    if (!resp.ok || !content) {
      return NextResponse.json(
        { error: data?.error?.message || 'Failed to continue narrative turn.' },
        { status: resp.status || 500 }
      )
    }

    const parsed = tryParseJson<Partial<NarrativeTurnResponse>>(content)
    const fallbackNpcName = narrative.npcs[0]?.name || 'Advisor'
    const turn = normalizeTurnResponse(parsed ?? {}, fallbackNpcName)

    return NextResponse.json({ turn }, { headers: rateLimitHeaders(limit) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
