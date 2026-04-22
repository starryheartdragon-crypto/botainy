/**
 * Reputation helpers — server-side only (uses service role key).
 * Call these from API routes after significant user actions.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceClient() {
  return createClient(supabaseUrl, serviceRoleKey)
}

export type ReputationEventType =
  | 'badge_received'
  | 'bot_created'
  | 'message_sent'
  | 'login_streak'
  | 'chat_room_joined'

const EVENT_POINTS: Record<ReputationEventType, number> = {
  badge_received: 0, // overridden per-badge below
  bot_created: 5,
  message_sent: 1,
  login_streak: 3,
  chat_room_joined: 2,
}

/**
 * Award reputation points to a user and log the event.
 * For badge_received, pass `badgePoints` to override the default.
 */
export async function awardReputation(
  userId: string,
  eventType: ReputationEventType,
  options?: { refId?: string; badgePoints?: number }
) {
  const db = serviceClient()
  const points =
    eventType === 'badge_received' && options?.badgePoints !== undefined
      ? options.badgePoints
      : EVENT_POINTS[eventType]

  if (points <= 0) return

  // Insert reputation event
  await db.from('reputation_events').insert({
    user_id: userId,
    event_type: eventType,
    points,
    ref_id: options?.refId ?? null,
  })

  // Upsert user_reputation totals
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: existing } = await db
    .from('user_reputation')
    .select('all_time, monthly, monthly_year, monthly_month')
    .eq('user_id', userId)
    .single()

  if (!existing) {
    await db.from('user_reputation').insert({
      user_id: userId,
      all_time: points,
      monthly: points,
      monthly_year: year,
      monthly_month: month,
    })
  } else {
    const isSameMonth = existing.monthly_year === year && existing.monthly_month === month
    await db.from('user_reputation').update({
      all_time: existing.all_time + points,
      monthly: isSameMonth ? existing.monthly + points : points,
      monthly_year: year,
      monthly_month: month,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }
}

/**
 * Auto-award a badge from the system inventory.
 * Creates an inventory row (already marked gifted=true) and a received row.
 */
export async function autoAwardBadge(
  recipientId: string,
  badgeSlug: string,
  eventType: ReputationEventType = 'badge_received'
) {
  const db = serviceClient()

  const { data: badge } = await db
    .from('badges')
    .select('id, reputation_points, is_active')
    .eq('slug', badgeSlug)
    .single()

  if (!badge || !badge.is_active) return null

  // Create an inventory row that's immediately marked as gifted (system award)
  const { data: inv } = await db
    .from('user_badge_inventory')
    .insert({ user_id: recipientId, badge_id: badge.id, gifted: true })
    .select('id')
    .single()

  const { data: received } = await db
    .from('user_badges_received')
    .insert({
      recipient_id: recipientId,
      gifter_id: null,
      badge_id: badge.id,
      inventory_id: inv?.id ?? null,
    })
    .select('id')
    .single()

  await awardReputation(recipientId, eventType, {
    refId: received?.id,
    badgePoints: badge.reputation_points,
  })

  return received
}
