import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit'
import { getOpenRouterErrorMessage, resolveOpenRouterApiKey, resolveOpenRouterModel, resolveOpenRouterReferer } from '@/lib/openrouterServer'

type Message = { role: string; content: string }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const authClient = createClient(supabaseUrl, supabaseAnonKey)

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
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit({
      bucket: 'openrouter',
      key: user.id,
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

    const body = await req.json()
    const messages: Message[] = body.messages
    const model = typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : resolveOpenRouterModel('openrouter/auto')

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid messages array' }, { status: 400 })
    }

    const openrouterApiKey = resolveOpenRouterApiKey()
    if (!openrouterApiKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Forward request to OpenRouter securely from the server
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': resolveOpenRouterReferer(),
        'X-Title': 'Botainy',
      },
      body: JSON.stringify({ model, messages }),
    })

    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      return NextResponse.json(
        { error: getOpenRouterErrorMessage(data, `OpenRouter request failed with status ${resp.status}`), model },
        {
          status: resp.status,
          headers: rateLimitHeaders(limit),
        }
      )
    }

    return NextResponse.json(data, {
      status: resp.status,
      headers: rateLimitHeaders(limit),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
