/**
 * GET /api/leaderboard
 * Returns cached leaderboard entries.
 * Query params:
 *   type: 'all_time' | 'monthly' | 'badge:{slug}'  (default: 'all_time')
 *   limit: number (default 25, max 100)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const boardType = url.searchParams.get('type') ?? 'all_time'
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '25', 10), 100)

  const { data, error } = await serviceClient()
    .from('leaderboard_snapshots')
    .select(`
      rank,
      user_id,
      score,
      snapshot_at,
      user:users(id, username, avatar_url)
    `)
    .eq('board_type', boardType)
    .order('rank')
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
