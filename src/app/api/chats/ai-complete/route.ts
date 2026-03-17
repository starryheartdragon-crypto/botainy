
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callOpenRouter } from '@/lib/openrouterServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
// const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Not used

// Helper to get user from auth header
async function getUserFromAuthHeader(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { user: null, error: 'Unauthorized' };
  const authClient = () => createClient(supabaseUrl!, supabaseAnonKey!);
  const { data: { user }, error } = await authClient().auth.getUser(token);
  if (error || !user) return { user: null, error: 'Unauthorized' };
  return { user, error: null };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const { user, error: authError } = await getUserFromAuthHeader(authHeader);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lastBotMessage, userDraft, persona } = body;
    if (lastBotMessage === undefined || userDraft === undefined) {
      return NextResponse.json({ error: 'Missing lastBotMessage or userDraft' }, { status: 400 });
    }

    // Construct prompt
    const personaContext = persona
      ? `The user is roleplaying as ${persona.name}. ${persona.description ? persona.description : ''}`
      : 'The user is chatting as themselves.';
    const prompt = [
      personaContext,
      '',
      'The bot just said:',
      lastBotMessage || '(start of conversation)',
      '',
      `The user has started typing their reply but has not finished it. Complete the user's message naturally, staying true to the user's voice and intent. Do NOT write the bot's response — only continue what the user has already written.`,
      '',
      `User's draft: ${userDraft}`,
    ].join('\n');

    // Call OpenRouter
    const aiResponse = await callOpenRouter({ prompt });
    if (!aiResponse) {
      return NextResponse.json({ error: 'AI completion failed' }, { status: 500 });
    }

    return NextResponse.json({ suggestion: aiResponse });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate AI suggestion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
