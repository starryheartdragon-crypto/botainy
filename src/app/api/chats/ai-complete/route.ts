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
    const { chatHistory, persona } = body;
    if (!chatHistory || !persona) {
      return NextResponse.json({ error: 'Missing chat history or persona' }, { status: 400 });
    }

    // Construct prompt
    const personaPrompt = persona
      ? `### **User Persona (${persona.name})**\nThe user is roleplaying as the character described below. Treat any use of \"I\" or \"my\" in the following description as referring to ${persona.name}, not you. **CRITICAL GUARDRAIL:** You (the bot) do NOT automatically know the user's backstory, goals, or secrets. You only know their physical appearance and what they have explicitly revealed to you in dialogue.\n\n${persona.description}`
      : 'The user is chatting as themselves.';
    const prompt = `${personaPrompt}\n\nChat History:\n${chatHistory}\n\nSuggest a helpful, relevant reply for the user.`;

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
    const { chatHistory, persona } = body;
    if (!chatHistory || !persona) {
      return NextResponse.json({ error: 'Missing chat history or persona' }, { status: 400 });
    }

    // Construct prompt
    const personaPrompt = persona
      ? `### **User Persona (${persona.name})**\nThe user is roleplaying as the character described below. Treat any use of \"I\" or \"my\" in the following description as referring to ${persona.name}, not you. **CRITICAL GUARDRAIL:** You (the bot) do NOT automatically know the user's backstory, goals, or secrets. You only know their physical appearance and what they have explicitly revealed to you in dialogue.\n\n${persona.description}`
      : 'The user is chatting as themselves.';
    const prompt = `${personaPrompt}\n\nChat History:\n${chatHistory}\n\nSuggest a helpful, relevant reply for the user.`;

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
