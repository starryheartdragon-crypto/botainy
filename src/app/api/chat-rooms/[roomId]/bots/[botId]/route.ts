import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function DELETE(req: NextRequest, { params }: { params: { roomId: string, botId: string } }) {
  const { roomId, botId } = params
  // Remove bot from room
  const { error } = await supabase
    .from('room_active_bots')
    .delete()
    .eq('room_id', roomId)
    .eq('bot_id', botId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
