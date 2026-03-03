import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const authClient = createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = createClient(supabaseUrl, serviceRoleKey)

function isYouTubePlaylistUrl(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const list = url.searchParams.get('list')
    if (!list) return false
    return host.includes('youtube.com') || host.includes('youtu.be')
  } catch {
    return false
  }
}

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: settings, error: settingsError } = await serviceClient
      .from('user_music_settings')
      .select('youtube_playlist_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }

    const { data: tracks, error: tracksError } = await serviceClient
      .from('user_music_tracks')
      .select('id, title, url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (tracksError) {
      return NextResponse.json({ error: tracksError.message }, { status: 500 })
    }

    return NextResponse.json({
      playlistUrl: settings?.youtube_playlist_url || null,
      tracks: tracks || [],
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const playlistUrl = String(body?.playlistUrl || '').trim()

    if (!playlistUrl || !isYouTubePlaylistUrl(playlistUrl)) {
      return NextResponse.json({ error: 'Valid YouTube playlist URL required' }, { status: 400 })
    }

    const { count, error: countError } = await serviceClient
      .from('user_music_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if ((count || 0) > 0) {
      return NextResponse.json({ error: 'Remove uploaded tracks before setting playlist' }, { status: 400 })
    }

    const { error } = await serviceClient
      .from('user_music_settings')
      .upsert({
        user_id: user.id,
        youtube_playlist_url: playlistUrl,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, playlistUrl })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const trackId = String(body?.trackId || '').trim()
    const clearPlaylist = !!body?.clearPlaylist

    if (clearPlaylist) {
      const { error } = await serviceClient
        .from('user_music_settings')
        .upsert({
          user_id: user.id,
          youtube_playlist_url: null,
          updated_at: new Date().toISOString(),
        })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true })
    }

    if (trackId) {
      const { data: track, error: trackError } = await serviceClient
        .from('user_music_tracks')
        .select('id, storage_path')
        .eq('id', trackId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (trackError || !track) {
        return NextResponse.json({ error: 'Track not found' }, { status: 404 })
      }

      const { error: deleteRowError } = await serviceClient
        .from('user_music_tracks')
        .delete()
        .eq('id', trackId)
        .eq('user_id', user.id)

      if (deleteRowError) {
        return NextResponse.json({ error: deleteRowError.message }, { status: 500 })
      }

      await serviceClient.storage.from('music').remove([track.storage_path])

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Nothing to delete' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
