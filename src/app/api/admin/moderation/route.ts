import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

type UserAction = 'ban' | 'unban' | 'silence' | 'unsilence'
type BotAction = 'silence' | 'delete'
type ModerationPayload =
  | {
      targetType?: 'user'
      targetId?: string
      action?: UserAction
      explanation?: string
    }
  | {
      targetType?: 'bot'
      targetId?: string
      action?: BotAction
      explanation?: string
    }

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const {
    data: { user },
    error,
  } = await authClient().auth.getUser(token)

  if (error || !user) return null
  return user
}

async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: userRow, error: userError } = await serviceClient()
      .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (userError) {
    return { user: null, error: NextResponse.json({ error: userError.message }, { status: 500 }) }
  }

  if (!userRow?.is_admin) {
    return { user: null, error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { user, error: null }
}

function getUserNotification(action: UserAction) {
  if (action === 'ban') {
    return 'You have been banned by an admin. You can no longer participate in chat rooms.'
  }
  if (action === 'unban') {
    return 'Your ban has been lifted by an admin. You may now participate in chat rooms again.'
  }
  if (action === 'silence') {
    return 'You have been silenced by an admin. You cannot send messages in chat rooms.'
  }
  return 'Your silence has been lifted by an admin. You may now send messages in chat rooms again.'
}

export async function POST(req: NextRequest) {
  try {
    const { user: adminUser, error: adminError } = await requireAdmin(req)
    if (adminError || !adminUser) return adminError

    const body = (await req.json()) as ModerationPayload
    const targetType = body.targetType
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : ''
    const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : ''

    if (targetType !== 'user' && targetType !== 'bot') {
      return NextResponse.json({ error: 'targetType must be user or bot' }, { status: 400 })
    }

    if (!UUID_REGEX.test(targetId)) {
      return NextResponse.json({ error: 'Invalid target id' }, { status: 400 })
    }

    if (targetType === 'user') {
      const action = body.action as UserAction | undefined
      if (!action || !['ban', 'unban', 'silence', 'unsilence'].includes(action)) {
        return NextResponse.json({ error: 'Invalid user moderation action' }, { status: 400 })
      }

      if (targetId === adminUser.id && (action === 'ban' || action === 'silence')) {
        return NextResponse.json({ error: 'You cannot ban or silence yourself' }, { status: 400 })
      }

      const updateData: { is_banned?: boolean; is_silenced?: boolean } = {}
      if (action === 'ban') updateData.is_banned = true
      if (action === 'unban') updateData.is_banned = false
      if (action === 'silence') updateData.is_silenced = true
      if (action === 'unsilence') updateData.is_silenced = false

      const { data: updatedUser, error: updateError } = await serviceClient()
      .from('users')
        .update(updateData)
        .eq('id', targetId)
        .select('id, username, email, is_banned, is_silenced, is_admin')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      await serviceClient().from('mod_actions').insert({
        actor_id: adminUser.id,
        user_id: targetId,
        action,
        explanation: explanation || null,
      })

      const notificationMessage = explanation
        ? `${getUserNotification(action)} Reason: ${explanation}`
        : getUserNotification(action)

      await serviceClient().from('notifications').insert({
        user_id: targetId,
        message: notificationMessage,
      })

      return NextResponse.json({ user: updatedUser }, { status: 200 })
    }

    const action = body.action as BotAction | undefined
    if (!action || !['silence', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid bot moderation action' }, { status: 400 })
    }

    const { data: bot, error: botFetchError } = await serviceClient()
      .from('bots')
      .select('id, name, creator_id')
      .eq('id', targetId)
      .single()

    if (botFetchError || !bot) {
      return NextResponse.json({ error: botFetchError?.message || 'Bot not found' }, { status: 404 })
    }

    let updatedBot: {
      id: string
      name: string
      creator_id: string
      description: string | null
      is_published: boolean
    } | null = null

    if (action === 'silence') {
      const { data: silencedBot, error: botUpdateError } = await serviceClient()
      .from('bots')
        .update({ is_published: false })
        .eq('id', targetId)
        .select('id, name, creator_id, description, is_published')
        .single()

      if (botUpdateError) {
        return NextResponse.json({ error: botUpdateError.message }, { status: 500 })
      }

      updatedBot = silencedBot
    } else {
      const { error: botDeleteError } = await serviceClient()
      .from('bots')
        .delete()
        .eq('id', targetId)

      if (botDeleteError) {
        return NextResponse.json({ error: botDeleteError.message }, { status: 500 })
      }

      updatedBot = {
        id: bot.id,
        name: bot.name,
        creator_id: bot.creator_id,
        description: null,
        is_published: false,
      }
    }

    await serviceClient().from('mod_actions').insert({
      actor_id: adminUser.id,
      user_id: bot.creator_id,
      bot_id: targetId,
      action: action === 'silence' ? 'private' : 'delete',
      explanation: explanation || null,
    })

    const notificationMessage = explanation
      ? action === 'silence'
        ? `Your bot '${bot.name}' was set to private by an admin. Reason: ${explanation}`
        : `Your bot '${bot.name}' was deleted by an admin. Reason: ${explanation}`
      : action === 'silence'
        ? `Your bot '${bot.name}' was set to private by an admin.`
        : `Your bot '${bot.name}' was deleted by an admin.`

    await serviceClient().from('notifications').insert({
      user_id: bot.creator_id,
      message: notificationMessage,
    })

    return NextResponse.json({ bot: updatedBot }, { status: 200 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
