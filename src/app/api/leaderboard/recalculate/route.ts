/**
 * POST /api/leaderboard/recalculate
 * Protected by CRON_SECRET header (called by Cloudflare Cron trigger).
 * Recalculates and replaces all leaderboard snapshots.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const now = new Date().toISOString()

  // ── All-Time leaderboard ─────────────────────────────────────────────────
  const { data: allTime } = await db
    .from('user_reputation')
    .select('user_id, all_time')
    .order('all_time', { ascending: false })
    .limit(100)

  // ── Monthly leaderboard ──────────────────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const { data: monthly } = await db
    .from('user_reputation')
    .select('user_id, monthly')
    .eq('monthly_year', currentYear)
    .eq('monthly_month', currentMonth)
    .order('monthly', { ascending: false })
    .limit(100)

  // ── Per-badge niche leaderboards ─────────────────────────────────────────
  const { data: badges } = await db
    .from('badges')
    .select('id, slug')
    .eq('is_active', true)

  // Count received badges per user per badge slug
  const { data: badgeCounts } = await db
    .from('user_badges_received')
    .select('recipient_id, badge_id, badges!inner(slug)')

  // Build per-badge count maps
  const slugCountMap: Record<string, Record<string, number>> = {}
  for (const row of badgeCounts ?? []) {
    const slug = (row.badges as unknown as { slug: string })?.slug
    if (!slug) continue
    if (!slugCountMap[slug]) slugCountMap[slug] = {}
    slugCountMap[slug][row.recipient_id] = (slugCountMap[slug][row.recipient_id] ?? 0) + 1
  }

  // Delete all existing snapshots
  await db.from('leaderboard_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const rows: Array<{
    board_type: string
    rank: number
    user_id: string
    score: number
    snapshot_at: string
  }> = []

  // All-time rows
  for (let i = 0; i < (allTime ?? []).length; i++) {
    rows.push({
      board_type: 'all_time',
      rank: i + 1,
      user_id: allTime![i].user_id,
      score: allTime![i].all_time,
      snapshot_at: now,
    })
  }

  // Monthly rows
  for (let i = 0; i < (monthly ?? []).length; i++) {
    rows.push({
      board_type: 'monthly',
      rank: i + 1,
      user_id: monthly![i].user_id,
      score: monthly![i].monthly,
      snapshot_at: now,
    })
  }

  // Per-badge rows
  for (const [slug, userCounts] of Object.entries(slugCountMap)) {
    const sorted = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
    for (let i = 0; i < sorted.length; i++) {
      rows.push({
        board_type: `badge:${slug}`,
        rank: i + 1,
        user_id: sorted[i][0],
        score: sorted[i][1],
        snapshot_at: now,
      })
    }
  }

  if (rows.length > 0) {
    const { error } = await db.from('leaderboard_snapshots').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, rowsInserted: rows.length, recalculatedAt: now })
}
