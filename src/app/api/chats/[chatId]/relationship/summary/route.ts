import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenRouterErrorMessage, resolveOpenRouterApiKey, resolveOpenRouterModel, resolveOpenRouterReferer } from '@/lib/openrouterServer'

function getServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

function getAnonClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
  return createClient(url, key)
}

async function requireAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const { data: { user }, error } = await getAnonClient().auth.getUser(token)
  return (!error && user) ? user : null
}

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: unknown
}

// POST /api/chats/[chatId]/relationship/summary
// Generates an AI narrative summary of the current relationship dynamic and saves it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chatId } = await params
    const service = getServiceClient()

    // Verify ownership and get chat relationship data
    const { data: chat, error: chatError } = await service
      .from('chats')
      .select('id, user_id, relationship_context, relationship_score, relationship_tags, relationship_events, bots(name), personas(name)')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single()

    if (chatError || !chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    // Get last 30 messages for context
    const { data: messages } = await service
      .from('chat_messages')
      .select('sender_id, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(30)

    const botName = Array.isArray(chat.bots) ? (chat.bots[0] as { name: string })?.name : (chat.bots as { name: string } | null)?.name ?? 'the bot'
    const personaName = Array.isArray(chat.personas) ? (chat.personas[0] as { name: string })?.name : (chat.personas as { name: string } | null)?.name ?? 'the user'
    const score = chat.relationship_score ?? 0
    const tags = (chat.relationship_tags as string[] | null) ?? []
    const backstory = chat.relationship_context ?? ''

    const recentExchange = (messages ?? [])
      .reverse()
      .map((m) => `${m.sender_id === user.id ? personaName : botName}: ${m.content}`)
      .join('\n')

    const prompt = [
      `You are summarizing the relationship dynamic between "${botName}" and "${personaName}" in a roleplay context.`,
      backstory ? `Known backstory: ${backstory}` : '',
      tags.length ? `Relationship tags: ${tags.join(', ')}` : '',
      `Current relationship score: ${score}/100 (-100 = archrivals, 0 = neutral, 100 = lovers)`,
      recentExchange ? `\nRecent conversation:\n${recentExchange}` : '',
      `\nWrite a 2-3 sentence narrative summary of how ${botName} and ${personaName} relate to each other right now. Focus on emotional texture, tension, or warmth. Be evocative, not factual.`,
    ].filter(Boolean).join('\n')

    const apiKey = resolveOpenRouterApiKey()
    if (!apiKey) return NextResponse.json({ error: 'OpenRouter not configured' }, { status: 503 })

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': resolveOpenRouterReferer(),
        'X-Title': 'Botainy',
      },
      body: JSON.stringify({
        model: resolveOpenRouterModel('openrouter/auto'),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 200,
      }),
    })

    const data: OpenRouterResponse = await resp.json().catch(() => ({}))
    const summary = data?.choices?.[0]?.message?.content?.trim()

    if (!resp.ok || !summary) {
      const errMsg = getOpenRouterErrorMessage(data, `OpenRouter returned ${resp.status}`)
      return NextResponse.json({ error: errMsg }, { status: 500 })
    }

    // Save summary to chat
    await service.from('chats').update({ relationship_summary: summary }).eq('id', chatId)

    return NextResponse.json({ summary })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
