'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PersonaPromptModal } from '@/components/PersonaPromptModal'

const NEW_YORK_TIMEZONE = 'America/New_York'

function getNewYorkParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: NEW_YORK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00'

  return {
    year: Number(valueOf('year')),
    month: Number(valueOf('month')),
    day: Number(valueOf('day')),
    hour: Number(valueOf('hour')),
    minute: Number(valueOf('minute')),
    second: Number(valueOf('second')),
  }
}

function getCycleKey(parts: { year: number; month: number; day: number; hour: number }) {
  const cycleHour = Math.floor(parts.hour / 6) * 6
  return `${parts.year}-${parts.month}-${parts.day}:${cycleHour}`
}

interface ChatRoom {
  id: string
  name: string
  description: string | null
  background_url: string | null
  city_info: string | null
  notable_bots: string | null
  created_at: string
}

interface ChatRoomMemberPreview {
  user_id: string
  username: string | null
  persona_name: string | null
  is_active: boolean
}

export default function ChatRoomsPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null)
  const [joinedIds, setJoinedIds] = useState<Record<string, boolean>>({})
  const [membersLoadingId, setMembersLoadingId] = useState<string | null>(null)
  const [membersErrorByRoom, setMembersErrorByRoom] = useState<Record<string, string | null>>({})
  const [visibleMembersRoomId, setVisibleMembersRoomId] = useState<string | null>(null)
  const [membersByRoom, setMembersByRoom] = useState<Record<string, ChatRoomMemberPreview[]>>({})
  const [personaPromptOpen, setPersonaPromptOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ type: 'join'; roomId: string } | null>(null)
  const [requestName, setRequestName] = useState('')
  const [requestDetails, setRequestDetails] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const lastCycleRefreshRef = useRef<string | null>(null)

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [rooms]
  )

  const loadRooms = useCallback(async () => {
    try {
      const resp = await fetch('/api/chat-rooms', { cache: 'no-store' })
      if (!resp.ok) return
      const data = await resp.json()
      setRooms(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  useEffect(() => {
    const currentParts = getNewYorkParts(new Date())
    lastCycleRefreshRef.current = getCycleKey(currentParts)

    const intervalId = window.setInterval(() => {
      const ny = getNewYorkParts(new Date())
      const atBoundaryHour = ny.hour === 0 || ny.hour === 6 || ny.hour === 12 || ny.hour === 18
      const withinBoundaryMinute = ny.minute === 0

      if (!atBoundaryHour || !withinBoundaryMinute) {
        return
      }

      const cycleKey = getCycleKey(ny)
      if (cycleKey === lastCycleRefreshRef.current) {
        return
      }

      lastCycleRefreshRef.current = cycleKey
      void loadRooms()
    }, 15000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadRooms])

  const handleJoin = async (roomId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      window.location.href = '/login'
      return
    }

    try {
      setJoinLoadingId(roomId)
      const resp = await fetch(`/api/chat-rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (resp.ok) {
        setJoinedIds((prev) => ({ ...prev, [roomId]: true }))
      }
    } finally {
      setJoinLoadingId(null)
    }
  }

  const handleWithPersonaPrompt = (action: { type: 'join'; roomId: string }) => {
    setPendingAction(action)
    setPersonaPromptOpen(true)
  }

  const handleJoinAndEnterRoom = async (roomId: string, personaId?: string | null) => {
    await handleJoin(roomId)
    const query = personaId ? `?personaId=${encodeURIComponent(personaId)}` : ''
    router.push(`/chat-rooms/${roomId}${query}`)
  }

  const handleViewRoomMembers = async (roomId: string) => {
    if (visibleMembersRoomId === roomId) {
      setVisibleMembersRoomId(null)
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      window.location.href = '/login'
      return
    }

    setVisibleMembersRoomId(roomId)
    setMembersLoadingId(roomId)
    setMembersErrorByRoom((prev) => ({ ...prev, [roomId]: null }))

    try {
      await handleJoin(roomId)

      const resp = await fetch(`/api/chat-rooms/${roomId}/members`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}))
        setMembersErrorByRoom((prev) => ({
          ...prev,
          [roomId]: payload?.error || 'Failed to load room members.',
        }))
        return
      }

      const data = await resp.json()
      setMembersByRoom((prev) => ({
        ...prev,
        [roomId]: Array.isArray(data) ? data : [],
      }))
    } finally {
      setMembersLoadingId(null)
    }
  }

  const handleSubmitRoomRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setRequestMessage(null)

    const trimmedName = requestName.trim()
    const trimmedDetails = requestDetails.trim()

    if (!trimmedName || !trimmedDetails) {
      setRequestMessage('Please provide a room name and request details.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    try {
      setRequestLoading(true)

      const { error } = await supabase.from('chat_room_requests').insert({
        requester_id: user.id,
        requested_name: trimmedName,
        request_details: trimmedDetails,
      })

      if (error) throw error

      setRequestName('')
      setRequestDetails('')
      setRequestMessage('Request sent to admin for review.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send request'
      setRequestMessage(message)
    } finally {
      setRequestLoading(false)
    }
  }

  const getSortedMembers = (roomId: string) => {
    return [...(membersByRoom[roomId] || [])].sort((a, b) => {
      if (a.is_active !== b.is_active) {
        return Number(b.is_active) - Number(a.is_active)
      }

      const aName = a.persona_name || a.username || a.user_id
      const bName = b.persona_name || b.username || b.user_id
      return aName.localeCompare(bName)
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Chat Rooms</h1>
          <p className="text-sm sm:text-base text-gray-300">
            Community rooms are separate from private group chats.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-gray-700 bg-gray-900/70 p-4 sm:p-5">
          <h2 className="text-lg font-semibold mb-1">Request a New Chat Room</h2>
          <p className="text-sm text-gray-300 mb-4">
            Submit a short request and admins can review it in Admin -> Requests.
          </p>

          <form onSubmit={handleSubmitRoomRequest} className="space-y-3">
            <input
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Requested room name"
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white text-sm"
              required
            />
            <textarea
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              placeholder="What should this room be about?"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white text-sm resize-none"
              required
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400">{requestDetails.length}/500</span>
              <button
                type="submit"
                disabled={requestLoading}
                className="px-4 py-2 text-sm rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-60 transition"
              >
                {requestLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
            {requestMessage && (
              <div className="text-sm text-gray-200 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2">
                {requestMessage}
              </div>
            )}
          </form>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading rooms...</div>
        ) : sortedRooms.length === 0 ? (
          <div className="text-gray-400">No chat rooms available yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {sortedRooms.map((room) => (
              <div
                key={room.id}
                className="relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900/80"
              >
                {room.background_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={room.background_url}
                    alt={room.name}
                    className="absolute inset-0 h-full w-full object-cover opacity-20"
                  />
                )}
                <div className="relative z-10 p-4 sm:p-5">
                  <h2 className="text-lg sm:text-xl font-semibold">{room.name}</h2>
                  <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                    {room.description || 'No description provided.'}
                  </p>

                  {room.city_info && (
                    <p className="text-xs text-purple-300 mt-3 line-clamp-2">
                      {room.city_info}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleWithPersonaPrompt({ type: 'join', roomId: room.id })}
                      disabled={joinLoadingId === room.id}
                      className="px-4 py-2 text-sm rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 transition"
                    >
                      {joinLoadingId === room.id
                          ? 'Joining...'
                          : joinedIds[room.id]
                            ? 'Enter Room'
                            : 'Join'}
                    </button>

                    <button
                      onClick={() => handleViewRoomMembers(room.id)}
                      disabled={membersLoadingId === room.id}
                      className="px-4 py-2 text-sm rounded-full border border-gray-600 hover:border-gray-400 disabled:opacity-60 transition"
                    >
                      {membersLoadingId === room.id
                        ? 'Loading...'
                        : visibleMembersRoomId === room.id
                          ? 'Hide People'
                          : 'Who\'s In/Active'}
                    </button>
                  </div>

                  {visibleMembersRoomId === room.id && (
                    <div className="mt-3 rounded-lg border border-gray-700 bg-gray-950/70 p-3">
                      {membersErrorByRoom[room.id] ? (
                        <p className="text-xs text-red-300">{membersErrorByRoom[room.id]}</p>
                      ) : (membersByRoom[room.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400">No members yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {getSortedMembers(room.id).map((member) => (
                            <div key={member.user_id} className="flex items-center justify-between gap-2">
                              <p className="text-sm text-gray-200 truncate">
                                {member.persona_name || 'No Persona'}{' '}
                                <span className="text-xs text-gray-400">
                                  ({member.username || member.user_id})
                                </span>
                              </p>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  member.is_active
                                    ? 'text-green-200 border-green-700 bg-green-950/40'
                                    : 'text-gray-300 border-gray-700 bg-gray-900/80'
                                }`}
                              >
                                {member.is_active ? 'Active' : 'In Room'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PersonaPromptModal
        open={personaPromptOpen}
        title="Choose Persona for Chat Room"
        onCancel={() => {
          setPersonaPromptOpen(false)
          setPendingAction(null)
        }}
        onConfirm={async (personaId) => {
          if (!pendingAction) return
          const action = pendingAction

          if (typeof window !== 'undefined') {
            const storageKey = `chat-room-persona:${action.roomId}`
            if (personaId) {
              window.localStorage.setItem(storageKey, personaId)
            } else {
              window.localStorage.removeItem(storageKey)
            }
          }

          setPersonaPromptOpen(false)
          setPendingAction(null)

          await handleJoinAndEnterRoom(action.roomId, personaId)
        }}
      />
    </div>
  )
}
