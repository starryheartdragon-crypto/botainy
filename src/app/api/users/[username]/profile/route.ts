import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

function getAnonClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!
  return createClient(url, key)
}

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const { data: { user }, error } = await getAnonClient().auth.getUser(token)
  return (!error && user) ? user : null
}

// GET /api/users/[username]/profile
// Public profile — applies per-field privacy to non-owners
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const service = getServiceClient()
    const viewer = await getAuthUser(req)

    // Resolve target user by username
    const { data: targetUser, error: userError } = await service
      .from('users')
      .select('id, username, bio, avatar_url, created_at, pronouns, location, accent_color, interest_tags')
      .eq('username', username)
      .maybeSingle()

    if (userError) return NextResponse.json({ error: userError.message }, { status: 500 })
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const isOwner = viewer?.id === targetUser.id

    // Fetch privacy settings (use defaults if none set)
    const { data: privacy } = await service
      .from('profile_privacy_settings')
      .select('show_bio, show_avatar, show_bots, show_music, show_connections_count, show_join_date, show_pronouns, show_location, show_tags, section_order')
      .eq('user_id', targetUser.id)
      .maybeSingle()

    const priv = {
      show_bio: privacy?.show_bio ?? true,
      show_avatar: privacy?.show_avatar ?? true,
      show_bots: privacy?.show_bots ?? true,
      show_music: privacy?.show_music ?? true,
      show_connections_count: privacy?.show_connections_count ?? true,
      show_join_date: privacy?.show_join_date ?? true,
      show_pronouns: privacy?.show_pronouns ?? true,
      show_location: privacy?.show_location ?? true,
      show_tags: privacy?.show_tags ?? true,
      section_order: privacy?.section_order ?? ['bio', 'tags', 'music', 'bots', 'personas', 'guestbook'],
    }

    // Aggregate counts
    const [followersResult, followingResult, likesResult, connectionsResult] = await Promise.all([
      service.from('profile_follows').select('id', { count: 'exact', head: true }).eq('following_id', targetUser.id),
      service.from('profile_follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetUser.id),
      service.from('profile_likes').select('id', { count: 'exact', head: true }).eq('profile_user_id', targetUser.id),
      service.from('user_connections').select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${targetUser.id},addressee_id.eq.${targetUser.id}`)
        .eq('status', 'accepted'),
    ])

    // Viewer-specific state
    let viewerIsFollowing = false
    let viewerHasLiked = false
    let viewerConnectionStatus: string | null = null
    if (viewer && !isOwner) {
      const [followCheck, likeCheck, connCheck] = await Promise.all([
        service.from('profile_follows')
          .select('id').eq('follower_id', viewer.id).eq('following_id', targetUser.id).maybeSingle(),
        service.from('profile_likes')
          .select('id').eq('user_id', viewer.id).eq('profile_user_id', targetUser.id).maybeSingle(),
        service.from('user_connections')
          .select('status, requester_id')
          .or(`and(requester_id.eq.${viewer.id},addressee_id.eq.${targetUser.id}),and(requester_id.eq.${targetUser.id},addressee_id.eq.${viewer.id})`)
          .maybeSingle(),
      ])
      viewerIsFollowing = !!followCheck.data
      viewerHasLiked = !!likeCheck.data
      viewerConnectionStatus = connCheck.data?.status ?? null
    }

    // Fetch public bots if allowed
    let bots: unknown[] = []
    if (isOwner || priv.show_bots) {
      const { data: botsData } = await service
        .from('bots')
        .select('id, name, description, avatar_url, universe, created_at')
        .eq('creator_id', targetUser.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(20)
      bots = botsData ?? []
    }

    // Fetch music if allowed
    let music: { playlistUrl: string | null; tracks: unknown[] } | null = null
    if (isOwner || priv.show_music) {
      const [settingsResult, tracksResult] = await Promise.all([
        service.from('user_music_settings').select('youtube_playlist_url').eq('user_id', targetUser.id).maybeSingle(),
        service.from('user_music_tracks').select('id, title, url, track_order').eq('user_id', targetUser.id).order('track_order', { ascending: true }),
      ])
      music = { playlistUrl: settingsResult.data?.youtube_playlist_url ?? null, tracks: tracksResult.data ?? [] }
    }

    return NextResponse.json({
      id: targetUser.id,
      username: targetUser.username,
      bio: (isOwner || priv.show_bio) ? targetUser.bio : null,
      avatar_url: (isOwner || priv.show_avatar) ? targetUser.avatar_url : null,
      join_date: (isOwner || priv.show_join_date) ? targetUser.created_at : null,
      pronouns: (isOwner || priv.show_pronouns) ? (targetUser.pronouns ?? null) : null,
      location: (isOwner || priv.show_location) ? (targetUser.location ?? null) : null,
      accent_color: targetUser.accent_color ?? null,
      interest_tags: (isOwner || priv.show_tags) ? (targetUser.interest_tags ?? []) : [],
      followers_count: followersResult.count ?? 0,
      following_count: followingResult.count ?? 0,
      likes_count: likesResult.count ?? 0,
      connections_count: (isOwner || priv.show_connections_count) ? (connectionsResult.count ?? 0) : null,
      bots,
      music,
      privacy: isOwner ? priv : null,
      section_order: priv.section_order,
      viewer_is_following: viewerIsFollowing,
      viewer_has_liked: viewerHasLiked,
      viewer_connection_status: viewerConnectionStatus,
      is_owner: isOwner,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
