'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

type Bot = {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  universe: string | null
  created_at: string
}

type Comment = {
  id: string
  content: string
  created_at: string
  author_id: string
  users: { username: string; avatar_url: string | null } | null
}

type PublicProfile = {
  id: string
  username: string
  bio: string | null
  avatar_url: string | null
  join_date: string | null
  followers_count: number
  following_count: number
  likes_count: number
  connections_count: number | null
  bots: Bot[]
  music: { playlistUrl: string | null; tracks: Array<{ id: string; title: string; url: string; order: number }> } | null
  viewer_is_following: boolean
  viewer_has_liked: boolean
  viewer_connection_status: string | null
  is_owner: boolean
}

function extractPlaylistId(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('list')
  } catch {
    return null
  }
}

function scoreToStage(score: number): { label: string; color: string } {
  if (score <= -76) return { label: 'Archrivals', color: 'text-red-600' }
  if (score <= -51) return { label: 'Bitter Enemies', color: 'text-red-500' }
  if (score <= -26) return { label: 'Rivals', color: 'text-orange-500' }
  if (score <= -11) return { label: 'Cold Strangers', color: 'text-gray-400' }
  if (score <= 10) return { label: 'Neutral', color: 'text-gray-300' }
  if (score <= 25) return { label: 'Acquaintances', color: 'text-blue-300' }
  if (score <= 50) return { label: 'Friends', color: 'text-blue-400' }
  if (score <= 75) return { label: 'Close Friends', color: 'text-purple-400' }
  if (score <= 90) return { label: 'Deeply Bonded', color: 'text-purple-300' }
  if (score <= 99) return { label: 'Devoted', color: 'text-pink-400' }
  return { label: 'Lovers', color: 'text-pink-500' }
}

export default function PublicProfilePage() {
  const params = useParams()
  const username = typeof params?.username === 'string' ? params.username : Array.isArray(params?.username) ? params.username[0] : ''
  const router = useRouter()

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [viewerToken, setViewerToken] = useState<string | null>(null)

  const fetchProfile = useCallback(async (token: string | null) => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const resp = await fetch(`/api/users/${username}/profile`, { headers })
      if (!resp.ok) {
        if (resp.status === 404) { router.push('/explore'); return }
        throw new Error('Failed to load profile')
      }
      const data: PublicProfile = await resp.json()
      setProfile(data)
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [username, router])

  const fetchComments = useCallback(async () => {
    const resp = await fetch(`/api/users/${username}/comments?limit=20&offset=0`)
    if (resp.ok) {
      const data = await resp.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    }
  }, [username])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setViewerToken(session?.access_token ?? null)
      fetchProfile(session?.access_token ?? null)
    })
    fetchComments()
  }, [fetchProfile, fetchComments])

  const handleFollow = async () => {
    if (!viewerToken) { toast.error('Sign in to follow'); return }
    setFollowLoading(true)
    try {
      const resp = await fetch(`/api/users/${username}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${viewerToken}` },
      })
      if (!resp.ok) throw new Error()
      const data = await resp.json()
      setProfile((prev) => prev ? {
        ...prev,
        viewer_is_following: data.following,
        followers_count: prev.followers_count + (data.following ? 1 : -1),
      } : prev)
      toast.success(data.following ? `Following ${username}` : 'Unfollowed')
    } catch {
      toast.error('Failed to update follow')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleLike = async () => {
    if (!viewerToken) { toast.error('Sign in to like'); return }
    setLikeLoading(true)
    try {
      const resp = await fetch(`/api/users/${username}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${viewerToken}` },
      })
      if (!resp.ok) throw new Error()
      const data = await resp.json()
      setProfile((prev) => prev ? {
        ...prev,
        viewer_has_liked: data.liked,
        likes_count: data.likes_count,
      } : prev)
    } catch {
      toast.error('Failed to update like')
    } finally {
      setLikeLoading(false)
    }
  }

  const handleSendConnectionRequest = async () => {
    if (!viewerToken) { toast.error('Sign in to connect'); return }
    if (!profile) return
    try {
      const resp = await fetch('/api/connections', {
        method: 'POST',
        headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressee_id: profile.id }),
      })
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || 'Failed') }
      setProfile((prev) => prev ? { ...prev, viewer_connection_status: 'pending' } : prev)
      toast.success('Connection request sent!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send request')
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!viewerToken) { toast.error('Sign in to comment'); return }
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const resp = await fetch(`/api/users/${username}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      if (!resp.ok) throw new Error()
      const newComment: Comment = await resp.json()
      setComments((prev) => [newComment, ...prev])
      setCommentText('')
      toast.success('Comment posted!')
    } catch {
      toast.error('Failed to post comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!viewerToken) return
    try {
      const resp = await fetch(`/api/users/${username}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${viewerToken}` },
      })
      if (!resp.ok) throw new Error()
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      toast.error('Failed to delete comment')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Loading profile...</div>
      </div>
    )
  }

  if (!profile) return null

  const playlistId = extractPlaylistId(profile.music?.playlistUrl ?? null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-r from-purple-900/40 via-gray-900 to-pink-900/30 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full border-4 border-purple-500 object-cover shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-purple-600 bg-gradient-to-br from-purple-700 to-pink-700 flex items-center justify-center text-4xl font-bold shadow-xl">
                {profile.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>

          {/* Name & Bio */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
            {profile.bio && <p className="mt-1 text-gray-300 text-sm max-w-lg">{profile.bio}</p>}
            {profile.join_date && (
              <p className="mt-1 text-xs text-gray-500">
                Joined {new Date(profile.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Actions (not shown for owner) */}
          {!profile.is_owner && (
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  profile.viewer_is_following
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {followLoading ? '...' : profile.viewer_is_following ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={handleLike}
                disabled={likeLoading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  profile.viewer_has_liked
                    ? 'bg-pink-700 hover:bg-pink-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                {likeLoading ? '...' : profile.viewer_has_liked ? '♥ Liked' : '♡ Like'}
              </button>
              {!profile.viewer_connection_status && (
                <button
                  onClick={handleSendConnectionRequest}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white transition"
                >
                  + Connect
                </button>
              )}
              {profile.viewer_connection_status === 'pending' && (
                <span className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-400">Request Sent</span>
              )}
              {profile.viewer_connection_status === 'accepted' && (
                <span className="px-4 py-2 rounded-lg text-sm bg-green-900/50 text-green-400">Connected</span>
              )}
            </div>
          )}
          {profile.is_owner && (
            <Link
              href="/profile"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 transition"
            >
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap gap-6 text-center sm:text-left">
          <div>
            <span className="text-xl font-bold text-white">{profile.followers_count}</span>
            <span className="text-gray-400 text-sm ml-1">Followers</span>
          </div>
          <div>
            <span className="text-xl font-bold text-white">{profile.following_count}</span>
            <span className="text-gray-400 text-sm ml-1">Following</span>
          </div>
          <div>
            <span className="text-xl font-bold text-pink-400">{profile.likes_count}</span>
            <span className="text-gray-400 text-sm ml-1">Likes</span>
          </div>
          {profile.connections_count !== null && (
            <div>
              <span className="text-xl font-bold text-blue-400">{profile.connections_count}</span>
              <span className="text-gray-400 text-sm ml-1">Connections</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Music Player */}
        {profile.music && (
          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-100">🎵 Soundtrack</h2>
            {playlistId ? (
              <div className="rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                <iframe
                  src={`https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=0`}
                  className="w-full h-48"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Profile Playlist"
                />
              </div>
            ) : profile.music.tracks.length > 0 ? (
              <div className="space-y-2">
                {profile.music.tracks.map((track) => (
                  <a
                    key={track.id}
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
                  >
                    <span className="text-purple-400">♪</span>
                    <span className="text-gray-200 text-sm">{track.title}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* Bots */}
        {profile.bots.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3 text-gray-100">🤖 Public Bots</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.bots.map((bot) => (
                <Link
                  key={bot.id}
                  href={`/chat?botId=${bot.id}`}
                  className="flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition group"
                >
                  {bot.avatar_url ? (
                    <Image src={bot.avatar_url} alt={bot.name} width={44} height={44} className="w-11 h-11 rounded-full object-cover border border-gray-600" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-700 to-pink-700 flex items-center justify-center text-lg font-bold text-white">
                      {bot.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white group-hover:text-purple-300 transition truncate">{bot.name}</p>
                    {bot.universe && <p className="text-xs text-gray-400 truncate">{bot.universe}</p>}
                    {bot.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{bot.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Guestbook */}
        <section>
          <h2 className="text-lg font-bold mb-3 text-gray-100">📖 Guestbook</h2>

          {/* Post comment form */}
          <form onSubmit={handlePostComment} className="mb-4 flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={500}
              placeholder="Leave a message..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={submittingComment || !commentText.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {submittingComment ? '...' : 'Post'}
            </button>
          </form>

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No messages yet. Be the first to leave one!</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 p-3 bg-gray-800/60 rounded-xl border border-gray-700/50">
                  {comment.users?.avatar_url ? (
                    <Image src={comment.users.avatar_url} alt={comment.users.username} width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0 mt-0.5">
                      {comment.users?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link href={`/profile/${comment.users?.username ?? ''}`} className="text-sm font-semibold text-purple-300 hover:text-purple-200">
                        {comment.users?.username ?? 'Unknown'}
                      </Link>
                      <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-200 break-words">{comment.content}</p>
                  </div>
                  {/* Delete button for author or profile owner */}
                  {viewerToken && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0 transition"
                      title="Delete comment"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// Expose scoreToStage so RelationshipContextPanel can import it too
export { scoreToStage }
