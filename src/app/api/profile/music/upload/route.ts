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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: settings } = await serviceClient()
      .from('user_music_settings')
      .select('youtube_playlist_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settings?.youtube_playlist_url) {
      return NextResponse.json({ error: 'Clear playlist before uploading tracks' }, { status: 400 })
    }

    const { count, error: countError } = await serviceClient()
      .from('user_music_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if ((count || 0) >= 12) {
      return NextResponse.json({ error: 'Track limit reached (12)' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const titleRaw = String(formData.get('title') || '').trim()

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('audio/')) {
      return NextResponse.json({ error: 'Only audio files are allowed' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop()
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
    const title = titleRaw || file.name.replace(/\.[^/.]+$/, '')

    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await serviceClient().storage
      .from('music')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = serviceClient().storage.from('music').getPublicUrl(storagePath)

    const { data: track, error: insertError } = await serviceClient()
      .from('user_music_tracks')
      .insert({
        user_id: user.id,
        title,
        url: urlData.publicUrl,
        storage_path: storagePath,
      })
      .select('id, title, url, created_at')
      .single()

    if (insertError) {
      await serviceClient().storage.from('music').remove([storagePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(track, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
