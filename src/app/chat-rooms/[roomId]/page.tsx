'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PersonaSelector } from '@/components/PersonaSelector'

interface RoomMessage {
  id: string
  room_id: string
  sender_id: string
  persona_id: string | null
  content: string
  created_at: string
  personas?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
}

interface RoomInfo {
  id: string
  name: string
  description: string | null
}

interface RoomMember {
  user_id: string
  joined_at: string
  username: string | null
  avatar_url: string | null
}

const normalizePersonaId = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null
  return trimmed
}

export default function ChatRoomDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages]
  )

  useEffect(() => {
    const storageKey = `chat-room-persona:${roomId}`
    const personaFromQuery = normalizePersonaId(searchParams.get('personaId'))
    const personaFromStorage =
      typeof window !== 'undefined' ? normalizePersonaId(window.localStorage.getItem(storageKey)) : null
    const nextPersonaId = personaFromQuery || personaFromStorage || null
    setSelectedPersonaId(nextPersonaId)

    if (typeof window !== 'undefined') {
      if (nextPersonaId) {
        window.localStorage.setItem(storageKey, nextPersonaId)
      } else {
        window.localStorage.removeItem(storageKey)
      }
    }
  }, [roomId, searchParams])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !session.access_token) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      await fetch(`/api/chat-rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const roomResp = await fetch('/api/chat-rooms')
      if (roomResp.ok) {
        const allRooms = await roomResp.json()
        const current = (allRooms || []).find((r: RoomInfo) => r.id === roomId)
        setRoom(current || null)
      }

      const msgResp = await fetch(`/api/chat-rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })

      if (msgResp.status === 403) {
        router.push('/chat-rooms')
        return
      }

      if (msgResp.ok) {
        const data = await msgResp.json()
        setMessages(Array.isArray(data) ? data : [])
      }

      const memberResp = await fetch(`/api/chat-rooms/${roomId}/members`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (memberResp.ok) {
        const data = await memberResp.json()
        setMembers(Array.isArray(data) ? data : [])
      }

      setLoading(false)
    }

    init()
  }, [roomId, router])

  const handleSelectPersona = (personaId: string | null) => {
    const normalizedPersonaId = normalizePersonaId(personaId)
    setSelectedPersonaId(normalizedPersonaId)
    if (typeof window !== 'undefined') {
      const storageKey = `chat-room-persona:${roomId}`
      if (normalizedPersonaId) {
        window.localStorage.setItem(storageKey, normalizedPersonaId)
      } else {
        window.localStorage.removeItem(storageKey)
      }
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`chat-room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_room_messages', filter: `room_id=eq.${roomId}` },
        async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.access_token) return

          const resp = await fetch(`/api/chat-rooms/${roomId}/messages`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store',
          })

          if (!resp.ok) return
          const data = await resp.json()
          setMessages(Array.isArray(data) ? data : [])
        }
      )
      .subscribe()

    const intervalId = window.setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const resp = await fetch(`/api/chat-rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })

      if (!resp.ok) return
      const data = await resp.json()
      setMessages(Array.isArray(data) ? data : [])
    }, 4000)

    return () => {
      window.clearInterval(intervalId)
      channel.unsubscribe()
    }
  }, [roomId])

  const sendMessage = async () => {
    const content = text.trim()
    if (!content) return
    setSendError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    try {
      setSending(true)
      let resp = await fetch(`/api/chat-rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content, personaId: selectedPersonaId }),
      })

      if (resp.status === 403) {
        await fetch(`/api/chat-rooms/${roomId}/join`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        resp = await fetch(`/api/chat-rooms/${roomId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ content, personaId: selectedPersonaId }),
        })
      }

      if (resp.ok) {
        const newMessage = await resp.json().catch(() => null)
        if (newMessage && typeof newMessage === 'object') {
          setMessages((prev) => {
            if (prev.some((message) => message.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage as RoomMessage]
          })
        }
        setText('')
      } else {
        const payload = await resp.json().catch(() => ({}))
        setSendError(payload?.error || 'Failed to send message')
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading room...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-800 px-4 sm:px-6 py-4 bg-gray-950/80">
          <h1 className="text-lg sm:text-xl font-semibold">{room?.name || 'Chat Room'}</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">{room?.description || 'Community room chat'}</p>
        </div>

        <PersonaSelector
          selectedPersonaId={selectedPersonaId}
          onSelectPersona={handleSelectPersona}
        />

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3">
          {sortedMessages.map((message) => {
            const mine = message.sender_id === userId
            const personaName = message.personas?.name
            const personaAvatar = message.personas?.avatar_url
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-md px-4 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 rounded-br-none' : 'bg-gray-800 rounded-bl-none'}`}>
                  {personaName && (
                    <div className="flex items-center gap-2 mb-1">
                      {personaAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={personaAvatar}
                          alt={personaName}
                          className="w-5 h-5 rounded-full object-cover border border-gray-500"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-600" />
                      )}
                      <span className="text-[11px] text-gray-200 font-medium truncate">{personaName}</span>
                    </div>
                  )}
                  <p className="break-words">{message.content}</p>
                  <p className="text-[10px] text-gray-300 mt-1">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-gray-800 p-3 sm:p-4 bg-gray-950">
          {sendError && (
            <div className="mb-2 text-xs text-red-300 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
              {sendError}
            </div>
          )}
          <div className="flex gap-2 sm:gap-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Message room..."
              className="flex-1 px-4 py-2 sm:py-3 bg-gray-900 border border-gray-700 rounded-full text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !text.trim()}
              className="px-5 sm:px-6 py-2 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 text-sm sm:text-base"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Chat room messages reset every 6 hours at 12am, 6am, 12pm, and 6pm (New York time).
          </p>
        </div>
      </div>

      {/* Sidebar: In room member list */}
      <aside className="w-full md:w-64 border-l border-gray-800 bg-gray-950/90 p-4 md:p-6 flex flex-col min-h-screen">
        <h2 className="text-base font-semibold text-gray-200 mb-3">In room ({members.length})</h2>
        <div className="flex flex-wrap md:flex-col gap-2">
          {members.length === 0 ? (
            <span className="text-xs text-gray-400">No members yet.</span>
          ) : (
            members.map((member) => (
              <span
                key={member.user_id}
                className="text-xs px-2 py-1 rounded-full border border-gray-700 bg-gray-900/80 text-gray-200 whitespace-nowrap"
              >
                {member.username || member.user_id}
              </span>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}
