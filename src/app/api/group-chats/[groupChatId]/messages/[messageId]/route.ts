import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = () => createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = () => createClient(supabaseUrl, serviceRoleKey)

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

// DELETE - Delete a group chat message (own messages or bot messages)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupChatId: string; messageId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId, messageId } = await params

    // Fetch the message and confirm it belongs to this group chat
    const { data: message, error: fetchError } = await serviceClient()
      .from('group_chat_messages')
      .select('id, sender_id, group_chat_id')
      .eq('id', messageId)
      .eq('group_chat_id', groupChatId)
      .single()

    if (fetchError || !message) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

    if (message.sender_id !== user.id) {
      // Not the sender — check if it's a bot message (sender is in bots table, not a user)
      const { data: bot } = await serviceClient()
        .from('bots')
        .select('id')
        .eq('id', message.sender_id)
        .maybeSingle()

      if (!bot) {
        // Sender is another user — not allowed
        return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
      }

      // It's a bot message — verify the requesting user is a member OR the creator
      const [{ data: member }, { data: groupChat }] = await Promise.all([
        serviceClient()
          .from('group_chat_members')
          .select('id')
          .eq('group_chat_id', groupChatId)
          .eq('user_id', user.id)
          .maybeSingle(),
        serviceClient()
          .from('group_chats')
          .select('creator_id')
          .eq('id', groupChatId)
          .single(),
      ])

      const isCreator = groupChat?.creator_id === user.id
      if (!member && !isCreator) {
        return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
      }
    }

    // Delete the message
    const { error: deleteError } = await serviceClient()
      .from('group_chat_messages')
      .delete()
      .eq('id', messageId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
