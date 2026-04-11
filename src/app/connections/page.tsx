'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface ConnectionItem {
  id: string
  status: 'pending' | 'accepted' | 'declined' | 'blocked'
  user: {
    id: string
    username: string | null
    avatar_url: string | null
    bio: string | null
    isAdmin?: boolean
  } | null
}

export default function ConnectionsPage() {
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [incoming, setIncoming] = useState<ConnectionItem[]>([])
  const [outgoing, setOutgoing] = useState<ConnectionItem[]>([])
  const [connections, setConnections] = useState<ConnectionItem[]>([])
  const [discover, setDiscover] = useState<Array<{ id: string; username: string | null; avatar_url: string | null; bio: string | null; isAdmin?: boolean }>>([])

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const loadConnections = useCallback(async (query = '') => {
    const token = await getToken()
    if (!token) {
      window.location.href = '/login'
      return
    }

    const url = query.trim() ? `/api/connections?q=${encodeURIComponent(query.trim())}` : '/api/connections'
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => null)
      toast.error(err?.error || 'Failed to load connections')
      return
    }
    const data = await resp.json()

    setIncoming(data.incoming || [])
    setOutgoing(data.outgoing || [])
    setConnections(data.connections || [])
    setDiscover(data.discover || [])
  }, [getToken])

  useEffect(() => {
    const init = async () => {
      try {
        await loadConnections()
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [loadConnections])

  const sendRequest = async (targetUserId: string) => {
    const token = await getToken()
    if (!token) return

    try {
      setBusyId(targetUserId)
      const resp = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      })

      if (resp.ok) {
        toast.success('Connection request sent')
        await loadConnections(search)
      } else {
        const err = await resp.json().catch(() => null)
        toast.error(err?.error || 'Failed to send request')
      }
    } finally {
      setBusyId(null)
    }
  }

  const updateConnection = async (
    connectionId: string,
    action: 'accept' | 'decline' | 'cancel' | 'remove',
    peerUserId?: string
  ) => {
    if (!uuidPattern.test(connectionId)) {
      toast.error('Invalid connection id')
      return
    }

    if (peerUserId && !uuidPattern.test(peerUserId)) {
      toast.error('Invalid target user id')
      return
    }

    const token = await getToken()
    if (!token) return

    try {
      setBusyId(connectionId)
      const resp = await fetch(`/api/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, peerUserId }),
      })

      if (resp.ok) {
        const messages: Record<string, string> = {
          accept: 'Request accepted',
          decline: 'Request declined',
          cancel: 'Request canceled',
          remove: 'Connection removed',
        }
        toast.success(messages[action] || 'Updated')
        await loadConnections(search)
      } else {
        const err = await resp.json().catch(() => null)
        toast.error(err?.error || 'Connection update failed')
      }
    } finally {
      setBusyId(null)
    }
  }

  const reportUser = async (targetUserId: string) => {
    const reason = window.prompt('Why are you reporting this user?')?.trim() || ''
    if (!reason) return

    const token = await getToken()
    if (!token) return

    try {
      setBusyId(`report:${targetUserId}`)

      const resp = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'user',
          targetId: targetUserId,
          reason,
        }),
      })

      if (resp.ok) {
        toast.success('Report submitted')
      } else {
        const err = await resp.json().catch(() => null)
        toast.error(err?.error || 'Failed to submit report')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Connections</h1>
        <p className="text-sm text-gray-400 mb-6">Connect with other users, manage requests, and build your network.</p>

        <div className="bg-gray-900/70 border border-gray-700 rounded-xl p-4 mb-8">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by username..."
              className="flex-1 px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white"
            />
            <button
              onClick={() => loadConnections(search)}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition"
            >
              Find
            </button>
          </div>

          {discover.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {discover.map((user) => (
                <div key={user.id} className="bg-gray-800/80 border border-gray-700 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      {user.username ? (
                        <Link href={`/profile/${user.username}`} className="hover:text-purple-300 transition">{user.username}</Link>
                      ) : (
                        <span>User</span>
                      )}
                      {user.isAdmin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700 text-purple-200">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.bio || 'No bio set'}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(user.id)}
                    disabled={busyId === user.id || busyId === `report:${user.id}`}
                    className="px-3 py-1.5 text-sm rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 transition"
                  >
                    {busyId === user.id ? '...' : 'Connect'}
                  </button>
                  <button
                    onClick={() => reportUser(user.id)}
                    disabled={busyId === `report:${user.id}` || busyId === user.id}
                    className="px-3 py-1.5 text-sm rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-60 transition"
                  >
                    {busyId === `report:${user.id}` ? '...' : 'Report'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400">Loading connections...</p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3">Incoming Requests</h2>
              {incoming.length === 0 ? (
                <p className="text-sm text-gray-500">No incoming requests.</p>
              ) : (
                <div className="space-y-3">
                  {incoming.map((item) => (
                    <div key={item.id} className="bg-gray-900/70 border border-gray-700 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {item.user?.username ? (
                            <Link href={`/profile/${item.user.username}`} className="hover:text-purple-300 transition">{item.user.username}</Link>
                          ) : (
                            <span>User</span>
                          )}
                          {item.user?.isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700 text-purple-200">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{item.user?.bio || 'No bio set'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateConnection(item.id, 'accept', item.user?.id)}
                          disabled={busyId === item.id}
                          className="px-3 py-1.5 text-sm rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => updateConnection(item.id, 'decline', item.user?.id)}
                          disabled={busyId === item.id}
                          className="px-3 py-1.5 text-sm rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-60"
                        >
                          Decline
                        </button>
                        {item.user?.id && (
                          <button
                            onClick={() => reportUser(item.user?.id || '')}
                            disabled={busyId === `report:${item.user?.id || ''}`}
                            className="px-3 py-1.5 text-sm rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-60"
                          >
                            {busyId === `report:${item.user?.id || ''}` ? '...' : 'Report'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Your Connections</h2>
              {connections.length === 0 ? (
                <p className="text-sm text-gray-500">No connections yet.</p>
              ) : (
                <div className="space-y-3">
                  {connections.map((item) => (
                    <div key={item.id} className="bg-gray-900/70 border border-gray-700 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {item.user?.username ? (
                            <Link href={`/profile/${item.user.username}`} className="hover:text-purple-300 transition">{item.user.username}</Link>
                          ) : (
                            <span>User</span>
                          )}
                          {item.user?.isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700 text-purple-200">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{item.user?.bio || 'No bio set'}</p>
                      </div>
                      <button
                        onClick={() => updateConnection(item.id, 'remove', item.user?.id)}
                        disabled={busyId === item.id}
                        className="px-3 py-1.5 text-sm rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-60"
                      >
                        Remove
                      </button>
                      {item.user?.id && (
                        <button
                          onClick={() => reportUser(item.user?.id || '')}
                          disabled={busyId === `report:${item.user?.id || ''}`}
                          className="px-3 py-1.5 text-sm rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-60"
                        >
                          {busyId === `report:${item.user?.id || ''}` ? '...' : 'Report'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Sent Requests</h2>
              {outgoing.length === 0 ? (
                <p className="text-sm text-gray-500">No pending sent requests.</p>
              ) : (
                <div className="space-y-3">
                  {outgoing.map((item) => (
                    <div key={item.id} className="bg-gray-900/70 border border-gray-700 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {item.user?.username ? (
                            <Link href={`/profile/${item.user.username}`} className="hover:text-purple-300 transition">{item.user.username}</Link>
                          ) : (
                            <span>User</span>
                          )}
                          {item.user?.isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700 text-purple-200">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">Awaiting response</p>
                      </div>
                      <button
                        onClick={() => updateConnection(item.id, 'cancel', item.user?.id)}
                        disabled={busyId === item.id}
                        className="px-3 py-1.5 text-sm rounded-full bg-yellow-700 hover:bg-yellow-600 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      {item.user?.id && (
                        <button
                          onClick={() => reportUser(item.user?.id || '')}
                          disabled={busyId === `report:${item.user?.id || ''}`}
                          className="px-3 py-1.5 text-sm rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-60"
                        >
                          {busyId === `report:${item.user?.id || ''}` ? '...' : 'Report'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
