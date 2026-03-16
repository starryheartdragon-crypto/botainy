import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  // Call OpenRouter API for LLM music suggestions
  const openrouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a music recommendation expert. Given a scene or character profile, suggest 3 tracks: Option A (period-accurate jazz), Option B (anachronistic modern rock), Option C (cinematic orchestral score). For each, provide title, artist, and reasoning.'
        },
        {
          role: 'user',
          content: text,
        }
      ],
      max_tokens: 300,
    }),
  });

  if (!openrouterResp.ok) {
    return NextResponse.json({ error: 'Failed to get music suggestions.' }, { status: 500 });
  }

  const data = await openrouterResp.json();
  // Parse LLM output (assume JSON or structured text)
  const suggestions = data.choices?.[0]?.message?.content || '';

  return NextResponse.json({ suggestions });
}
