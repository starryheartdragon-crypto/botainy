
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
    if (typeof userDraft !== 'string' || userDraft.trim() === '') {
      return NextResponse.json({ error: 'userDraft is required and must be non-empty' }, { status: 400 });
    }

    // System prompt scoped strictly to draft completion
    const systemPrompt = [
      'You are a writing assistant. Your ONLY job is to complete the user\'s unfinished message.',
      'Rules:',
      '- Output ONLY the completed message text — the user\'s draft with a natural continuation appended.',
      '- Do NOT output the bot\'s reply or any dialogue from any character other than the user.',
      '- Do NOT add explanations, labels, quotation marks, or any text outside the completed message.',
      '- If the draft is already complete as-is, output it unchanged.',
    ].join('\n');

    // Construct prompt
    const personaContext = persona
      ? `The user is roleplaying as ${persona.name}.${persona.description ? ' ' + persona.description : ''}`
      : 'The user is writing as themselves.';
    const prompt = [
      personaContext,
      '',
      `For context, the bot's last message was:`,
      lastBotMessage || '(start of conversation)',
      '',
      `The user has started typing their reply. Complete it naturally, preserving their voice and intent.`,
      '',
      `User's draft to complete: ${userDraft}`,
    ].join('\n');

    // Call OpenRouter
    const aiResponse = await callOpenRouter({ prompt, systemPrompt });
    if (!aiResponse) {
      return NextResponse.json({ error: 'AI completion failed' }, { status: 500 });
    }

    return NextResponse.json({ suggestion: aiResponse });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate AI suggestion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
