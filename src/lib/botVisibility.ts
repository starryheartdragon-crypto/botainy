import type { SupabaseClient } from '@supabase/supabase-js'

type GroupBotRow = {
  group_chat_id: string
  bot_id: string
}

type BotRow = {
  id: string
  creator_id: string
  is_published: boolean
}

type GroupMemberRow = {
  group_chat_id: string
  user_id: string
}

export async function getSharedPrivateBotIdsForUser(
  serviceClient: SupabaseClient,
  userId: string,
  candidateBotIds?: string[]
): Promise<Set<string>> {
  const { data: membershipRows, error: membershipError } = await serviceClient
    .from('group_chat_members')
    .select('group_chat_id')
    .eq('user_id', userId)

  if (membershipError) {
    throw new Error(membershipError.message)
  }

  const memberGroupIds = Array.from(
    new Set((membershipRows || []).map((row) => String(row.group_chat_id || '')).filter(Boolean))
  )

  if (memberGroupIds.length === 0) {
    return new Set<string>()
  }

  let groupBotsQuery = serviceClient
    .from('group_chat_bots')
    .select('group_chat_id, bot_id')
    .in('group_chat_id', memberGroupIds)

  const normalizedCandidateIds = Array.from(
    new Set((candidateBotIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  )

  if (normalizedCandidateIds.length > 0) {
    groupBotsQuery = groupBotsQuery.in('bot_id', normalizedCandidateIds)
  }

  const { data: groupBotRows, error: groupBotsError } = await groupBotsQuery

  if (groupBotsError) {
    throw new Error(groupBotsError.message)
  }

  const groupBots = (groupBotRows || []) as GroupBotRow[]
  if (groupBots.length === 0) {
    return new Set<string>()
  }

  const botIds = Array.from(new Set(groupBots.map((row) => row.bot_id)))

  const { data: botRows, error: botsError } = await serviceClient
    .from('bots')
    .select('id, creator_id, is_published')
    .in('id', botIds)
    .eq('is_published', false)

  if (botsError) {
    throw new Error(botsError.message)
  }

  const privateBots = ((botRows || []) as BotRow[]).filter((bot) => bot.creator_id !== userId)
  if (privateBots.length === 0) {
    return new Set<string>()
  }

  const privateBotIdSet = new Set(privateBots.map((bot) => bot.id))
  const creatorIds = Array.from(new Set(privateBots.map((bot) => bot.creator_id)))
  const relevantGroupIds = Array.from(
    new Set(groupBots.filter((row) => privateBotIdSet.has(row.bot_id)).map((row) => row.group_chat_id))
  )

  const { data: creatorMembershipRows, error: creatorMembershipError } = await serviceClient
    .from('group_chat_members')
    .select('group_chat_id, user_id')
    .in('group_chat_id', relevantGroupIds)
    .in('user_id', creatorIds)

  if (creatorMembershipError) {
    throw new Error(creatorMembershipError.message)
  }

  const creatorMembershipSet = new Set(
    ((creatorMembershipRows || []) as GroupMemberRow[]).map(
      (row) => `${row.group_chat_id}:${row.user_id}`
    )
  )

  const groupIdsByBot = new Map<string, string[]>()
  for (const row of groupBots) {
    if (!privateBotIdSet.has(row.bot_id)) continue
    const current = groupIdsByBot.get(row.bot_id) || []
    current.push(row.group_chat_id)
    groupIdsByBot.set(row.bot_id, current)
  }

  const sharedBotIds = new Set<string>()

  for (const bot of privateBots) {
    const groupIds = groupIdsByBot.get(bot.id) || []
    const canAccess = groupIds.some((groupId) => creatorMembershipSet.has(`${groupId}:${bot.creator_id}`))
    if (canAccess) {
      sharedBotIds.add(bot.id)
    }
  }

  return sharedBotIds
}

export async function canUserAccessBot(
  serviceClient: SupabaseClient,
  userId: string,
  bot: BotRow
): Promise<boolean> {
  if (bot.is_published || bot.creator_id === userId) {
    return true
  }

  const sharedPrivateBotIds = await getSharedPrivateBotIdsForUser(serviceClient, userId, [bot.id])
  return sharedPrivateBotIds.has(bot.id)
}
