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

// PATCH - Edit a message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 })
    }

    const { messageId } = await params

    // Check if user owns this message
    const { data: message, error: fetchError } = await serviceClient()
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .single()

    if (fetchError || !message || message.sender_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

    // Update message
    const { data: updated, error: updateError } = await serviceClient()
      .from('chat_messages')
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// DELETE - Delete a message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params

    // Check if user owns this message
    const { data: message, error: fetchError } = await serviceClient()
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .single()

    if (fetchError || !message || message.sender_id !== user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 403 })
    }

    // Delete message
    const { error: deleteError } = await serviceClient()
      .from('chat_messages')
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
