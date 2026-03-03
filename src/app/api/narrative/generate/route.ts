import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIpFromHeaders, rateLimitHeaders } from '@/lib/rateLimit'

type NarrativeChoice = {
  text: string
  effects?: Record<string, { affection?: number; suspicion?: number; fear?: number }>
}

type NarrativeNpc = {
  name: string
  role: string
  motive: string
  publicFace: string
  hiddenAgenda?: string
  relationship: {
    affection: number
    suspicion: number
    fear: number
  }
}

type NarrativeResponse = {
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
    choices: NarrativeChoice[]
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

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
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

function normalizeNarrative(payload: Partial<NarrativeResponse>): NarrativeResponse {
  const fallbackNpc: NarrativeNpc = {
    name: 'Captain Rhys',
    role: 'Security Chief',
    motive: 'Preserve order at any cost',
    publicFace: 'Disciplined and respectful',
    hiddenAgenda: 'Protects a secret ally in the conspiracy',
    relationship: { affection: 35, suspicion: 45, fear: 20 },
  }

  const npcsRaw = Array.isArray(payload.npcs) ? payload.npcs : []
  const npcs = (npcsRaw.length > 0 ? npcsRaw.slice(0, 4) : [fallbackNpc]).map((npc, index) => ({
    name: npc?.name?.trim() || `NPC ${index + 1}`,
    role: npc?.role?.trim() || 'Court Insider',
    motive: npc?.motive?.trim() || 'Advance their influence',
    publicFace: npc?.publicFace?.trim() || 'Composed',
    hiddenAgenda: npc?.hiddenAgenda?.trim() || undefined,
    relationship: {
      affection: clampMeter(npc?.relationship?.affection ?? 40),
      suspicion: clampMeter(npc?.relationship?.suspicion ?? 40),
      fear: clampMeter(npc?.relationship?.fear ?? 20),
    },
  }))

  const choicesRaw = payload.incitingIncident?.choices ?? []
  const choices: NarrativeChoice[] =
    Array.isArray(choicesRaw) && choicesRaw.length > 0
      ? choicesRaw.slice(0, 4).map((choice, index) => ({
          text: choice?.text?.trim() || `Choice ${index + 1}`,
          effects: choice?.effects && typeof choice.effects === 'object' ? choice.effects : undefined,
        }))
      : [
          { text: 'Command a lockdown and interrogate the nearest suspect.' },
          { text: 'Quietly gather evidence before revealing your move.' },
          { text: 'Feign ignorance and bait the conspirators into action.' },
        ]

  return {
    title: payload.title?.trim() || 'The First Hour of Intrigue',
    worldState: {
      setting: payload.worldState?.setting?.trim() || 'A fragile imperial court on the brink',
      vibe: payload.worldState?.vibe?.trim() || 'Tense, ceremonial, and paranoid',
      techLevel: payload.worldState?.techLevel?.trim() || 'Era-authentic governance and espionage',
      immediateStakes:
        payload.worldState?.immediateStakes?.trim() || 'A hidden faction is moving before sunrise',
      pressure: payload.worldState?.pressure?.trim() || 'Any wrong accusation could trigger civil fracture',
    },
    npcs,
    incitingIncident: {
      scene:
        payload.incitingIncident?.scene?.trim() ||
        'A coded memorial tablet is found in your private hall, signed by someone already executed.',
      choices,
    },
    director: {
      openingBeat:
        payload.director?.openingBeat?.trim() ||
        'Incense smoke drifts across lacquered pillars as every advisor waits for your first decree.',
      sensoryDetails:
        payload.director?.sensoryDetails?.trim() || 'Cold bronze, whispering silk, and sandalwood haze',
      tensionClock: payload.director?.tensionClock?.trim() || 'Dawn court session in 45 minutes',
    },
    dialogueStarter: {
      speaker: payload.dialogueStarter?.speaker?.trim() || npcs[0].name,
      line:
        payload.dialogueStarter?.line?.trim() ||
        '“Your Majesty, one command from you and I will have names before the lanterns burn out.”',
    },
    sceneCardPrompt:
      payload.sceneCardPrompt?.trim() ||
      'cinematic imperial palace interior, midnight intrigue, ornate red and gold, tense advisors, dramatic lighting, ultra detailed concept art',
  }
}

export async function POST(req: Request) {
  try {
    const limit = checkRateLimit({
      bucket: 'narrative-generate',
      key: getClientIpFromHeaders(req.headers),
      max: 20,
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

    const { identity, goalContext, tone, genreSetting, initialStakes, conflictType, vibeKeyword } = (await req.json()) as {
      identity?: string
      goalContext?: string
      tone?: string
      genreSetting?: string
      initialStakes?: string
      conflictType?: string
      vibeKeyword?: string
    }

    if (!identity?.trim() || !goalContext?.trim()) {
      return NextResponse.json(
        { error: 'Identity and goal/context are required.' },
        { status: 400 }
      )
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })
    }

    const systemPrompt = `You are a premium narrative engine for immersive roleplay setup generation.
Output ONLY valid JSON with this shape:
{
  "title": string,
  "worldState": {
    "setting": string,
    "vibe": string,
    "techLevel": string,
    "immediateStakes": string,
    "pressure": string
  },
  "npcs": [
    {
      "name": string,
      "role": string,
      "motive": string,
      "publicFace": string,
      "hiddenAgenda": string,
      "relationship": { "affection": number, "suspicion": number, "fear": number }
    }
  ],
  "incitingIncident": {
    "scene": string,
    "choices": [
      {
        "text": string,
        "effects": {
          "<npc name>": { "affection": number, "suspicion": number, "fear": number }
        }
      }
    ]
  },
  "director": {
    "openingBeat": string,
    "sensoryDetails": string,
    "tensionClock": string
  },
  "dialogueStarter": { "speaker": string, "line": string },
  "sceneCardPrompt": string
}

Rules:
- 3 to 4 NPCs with conflicting motives.
- Keep it vivid and specific.
- relationship meters must be 0-100.
- choices must place user directly into action.
- Never narrate user actions; offer options and pressure.
- No markdown, no explanations, only JSON.`

    const guidance: string[] = []
    if (genreSetting?.trim()) guidance.push(`Genre/Setting: ${genreSetting.trim()}`)
    if (initialStakes?.trim()) guidance.push(`Initial Stakes: ${initialStakes.trim()}`)
    if (conflictType?.trim()) guidance.push(`Primary Conflict Type: ${conflictType.trim()}`)
    if (vibeKeyword?.trim()) guidance.push(`Vibe Keyword: ${vibeKeyword.trim()}`)

    const userPrompt = `Identity: ${identity.trim()}\nGoal/Context: ${goalContext.trim()}\nTone: ${(tone || 'Cinematic, high-stakes, immersive').trim()}${guidance.length ? `\nOptional Guidance:\n${guidance.join('\n')}` : ''}`

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.9,
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
        { error: data?.error?.message || 'Narrative generation failed.' },
        { status: resp.status || 500 }
      )
    }

    const parsed = tryParseJson<Partial<NarrativeResponse>>(content)
    const narrative = normalizeNarrative(parsed ?? {})

    return NextResponse.json({ narrative }, { headers: rateLimitHeaders(limit) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
