import { NextRequest, NextResponse } from 'next/server';
import { callOpenRouter } from '@/lib/openrouterServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;
    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    // Construct bot creation prompt
    const aiPrompt = `Suggest a creative character bot for the following idea or theme. Return a name, description, and a suggested avatar concept.\n\nUser input: ${prompt}`;
    const aiResponse = await callOpenRouter({ prompt: aiPrompt });
    if (!aiResponse) {
      return NextResponse.json({ error: 'AI completion failed' }, { status: 500 });
    }

    return NextResponse.json({ suggestion: aiResponse });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate bot suggestion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
