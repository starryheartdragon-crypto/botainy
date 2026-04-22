/**
 * POST /api/badges/gift
 * Gift a badge from the authenticated user's inventory to another user.
 * Body: { inventoryId, recipientId, message? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { awardReputation } from '@/lib/reputation'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7)
  if (!token) return null
  const { data: { user } } = await authClient().auth.getUser(token)
  return user ?? null
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { inventoryId, recipientId, message } = body

  if (!inventoryId || !recipientId) {
    return NextResponse.json({ error: 'inventoryId and recipientId are required' }, { status: 400 })
  }

  if (recipientId === user.id) {
    return NextResponse.json({ error: 'You cannot gift a badge to yourself' }, { status: 400 })
  }

  const db = serviceClient()

  // Verify the inventory item belongs to the authenticated user and is not yet gifted
  const { data: inv, error: invError } = await db
    .from('user_badge_inventory')
    .select('id, badge_id, gifted, badge:badges(id, reputation_points, is_active)')
    .eq('id', inventoryId)
    .eq('user_id', user.id)
    .single()

  if (invError || !inv) {
    return NextResponse.json({ error: 'Badge not found in your inventory' }, { status: 404 })
  }
  if (inv.gifted) {
    return NextResponse.json({ error: 'This badge has already been gifted' }, { status: 409 })
  }

  const badge = inv.badge as { id: string; reputation_points: number; is_active: boolean } | null
  if (!badge?.is_active) {
    return NextResponse.json({ error: 'This badge is no longer active' }, { status: 400 })
  }

  // Verify recipient exists
  const { data: recipient } = await db
    .from('users')
    .select('id')
    .eq('id', recipientId)
    .single()

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  }

  // Mark inventory item as gifted
  const { error: updateError } = await db
    .from('user_badge_inventory')
    .update({ gifted: true })
    .eq('id', inventoryId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Create received badge record
  const { data: received, error: receivedError } = await db
    .from('user_badges_received')
    .insert({
      recipient_id: recipientId,
      gifter_id: user.id,
      badge_id: inv.badge_id,
      inventory_id: inventoryId,
      message: message?.trim() ?? null,
    })
    .select('id')
    .single()

  if (receivedError) {
    // Roll back gifted flag on failure
    await db.from('user_badge_inventory').update({ gifted: false }).eq('id', inventoryId)
    return NextResponse.json({ error: receivedError.message }, { status: 500 })
  }

  // Award reputation to recipient
  await awardReputation(recipientId, 'badge_received', {
    refId: received.id,
    badgePoints: badge.reputation_points,
  })

  return NextResponse.json({ success: true, receivedId: received.id }, { status: 201 })
}
