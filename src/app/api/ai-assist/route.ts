import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit'
import {
  getOpenRouterErrorMessage,
  resolveOpenRouterApiKey,
  resolveOpenRouterReferer,
} from '@/lib/openrouterServer'

// Always use auto-routing for AI assist so OpenRouter picks a capable
// creative-writing model, regardless of the primary chat model configured.
const AI_ASSIST_MODEL = 'openrouter/auto'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
)!
const authClient = () => createClient(supabaseUrl, supabaseAnonKey)

/** Field labels used in prompts */
const FIELD_LABELS: Record<string, string> = {
  description: 'Description (a concise overview of who this character is)',
  personality: 'Core Personality (temperament, values, quirks, emotional tone)',
  appearance: 'Appearance (physical features, build, hair, eyes, clothing, distinguishing marks)',
  backstory: 'Backstory (key events, origin, history, and lived experiences)',
  goals: 'Goals / Motivations (what this character wants and what drives them)',
  rules: 'Rules / Boundaries (hard constraints, off-limits topics, strict behavior rules)',
  style: 'Speaking Style (formal, poetic, sarcastic, short answers, etc.)',
  defaultTone: 'Default Tone (the emotional register — e.g. Romantic, Dark, Playful, Mysterious)',
  characterQuotes: 'Iconic Quotes (one quote per line, 3–5 signature phrases this character would actually say)',
  // Persona fields
  personaDescription: 'Overview (a concise description of who this persona is)',
  personaAppearance: 'Appearance (physical look, style, clothing)',
  personaBackstory: 'Backstory (origin story, key life events)',
  personaGoals: 'Goals & Intentions (what this persona wants out of interactions)',
}

function buildBotPrompt(field: string, data: Record<string, string>): string {
  const lines: string[] = ['You are helping a user flesh out an AI character bot for a roleplay platform.']

  lines.push('Here is what the user has already filled in:')
  if (data.name) lines.push(`- Name: ${data.name}`)
  if (data.universe) lines.push(`- Universe / IP: ${data.universe}`)
  if (data.gender) lines.push(`- Gender: ${data.gender}`)
  if (data.age) lines.push(`- Age: ${data.age}`)
  if (data.description && field !== 'description') lines.push(`- Description: ${data.description}`)
  if (data.personality && field !== 'personality') lines.push(`- Core Personality: ${data.personality}`)
  if (data.appearance && field !== 'appearance') lines.push(`- Appearance: ${data.appearance}`)
  if (data.backstory && field !== 'backstory') lines.push(`- Backstory: ${data.backstory}`)
  if (data.goals && field !== 'goals') lines.push(`- Goals: ${data.goals}`)
  if (data.rules && field !== 'rules') lines.push(`- Rules/Boundaries: ${data.rules}`)
  if (data.style && field !== 'style') lines.push(`- Speaking Style: ${data.style}`)
  if (data.defaultTone && field !== 'defaultTone') lines.push(`- Default Tone: ${data.defaultTone}`)

  const fieldLabel = FIELD_LABELS[field] ?? field

  lines.push('')
  lines.push(
    `Now write a detailed, vivid, and character-consistent suggestion for the field: "${fieldLabel}".`
  )
  lines.push(
    'Be specific, creative, and make it feel like a real, complex character. ' +
    'Do NOT include field labels or section headers — output only the content for that field. ' +
    'Aim for 2–5 sentences unless the field naturally warrants more. ' +
    'Keep it appropriate for an 18+ mature roleplay platform.'
  )

  return lines.join('\n')
}

function buildPersonaPrompt(field: string, data: Record<string, string>): string {
  const lines: string[] = [
    'You are helping a user create a persona — a character the user will role-play AS when chatting with AI bots on a roleplay platform.',
  ]

  lines.push('Here is what the user has already filled in:')
  if (data.name) lines.push(`- Persona Name: ${data.name}`)
  if (data.gender) lines.push(`- Gender: ${data.gender}`)
  if (data.personaDescription && field !== 'personaDescription')
    lines.push(`- Overview: ${data.personaDescription}`)
  if (data.personaAppearance && field !== 'personaAppearance')
    lines.push(`- Appearance: ${data.personaAppearance}`)
  if (data.personaBackstory && field !== 'personaBackstory')
    lines.push(`- Backstory: ${data.personaBackstory}`)
  if (data.personaGoals && field !== 'personaGoals')
    lines.push(`- Goals: ${data.personaGoals}`)

  const fieldLabel = FIELD_LABELS[field] ?? field

  lines.push('')
  lines.push(`Now write a detailed, vivid suggestion for the field: "${fieldLabel}".`)
  lines.push(
    'Make it feel like a real, fleshed-out character the user would enjoy playing. ' +
    'Do NOT include field labels or section headers — output only the content for that field. ' +
    'Aim for 2–4 sentences. Keep it appropriate for an 18+ mature roleplay platform.'
  )

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await authClient().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit({
      bucket: 'ai-assist',
      key: user.id,
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

    const body = (await req.json()) as {
      formType?: string
      field?: string
      formData?: Record<string, string>
    }

    const { formType, field, formData = {} } = body

    if (!formType || !field) {
      return NextResponse.json({ error: 'Missing formType or field' }, { status: 400 })
    }

    const openrouterApiKey = resolveOpenRouterApiKey()
    if (!openrouterApiKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const userPrompt =
      formType === 'persona'
        ? buildPersonaPrompt(field, formData)
        : buildBotPrompt(field, formData)

    const systemPrompt =
      'You are a creative writing assistant specializing in character development for roleplay platforms. ' +
      'You write vivid, specific, character-consistent content. ' +
      'You only output the requested field content — never labels, headers, or explanations.'

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': resolveOpenRouterReferer(),
        'X-Title': 'Botainy',
      },
      body: JSON.stringify({
        model: AI_ASSIST_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 512,
      }),
    })

    const data = (await resp.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: unknown
    } | null

    if (!resp.ok) {
      const upstreamMessage = getOpenRouterErrorMessage(
        data,
        `OpenRouter request failed with status ${resp.status}`
      )
      return NextResponse.json({ error: upstreamMessage }, { status: resp.status })
    }

    const suggestion = data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!suggestion) {
      return NextResponse.json({ error: 'No suggestion generated' }, { status: 500 })
    }

    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('[ai-assist] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
