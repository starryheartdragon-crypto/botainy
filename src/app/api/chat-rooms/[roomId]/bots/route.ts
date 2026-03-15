import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  // Fetch active bots for this room
  const { data, error } = await supabase
    .from('room_active_bots')
    .select('bot_id, bots(name, avatar_url)')
    .eq('room_id', roomId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Map bots
  const bots = (data || []).map((row: any) => ({
    id: row.bot_id,
    name: row.bots?.name || 'Unknown',
    avatar_url: row.bots?.avatar_url || null,
  }))
  return NextResponse.json(bots)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const { botId } = await req.json()
  // Add bot to room
  const { error } = await supabase
    .from('room_active_bots')
    .insert({ room_id: roomId, bot_id: botId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
