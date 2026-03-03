import { NextResponse } from 'next/server'

type Message = { role: string; content: string }

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const messages: Message[] = body.messages
    const model = body.model || 'gpt-4o-mini'

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid messages array' }, { status: 400 })
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    // Forward request to OpenRouter securely from the server
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({ model, messages }),
    })

    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
