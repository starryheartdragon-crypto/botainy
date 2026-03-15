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

"use client"

interface RoomInfo {
  id: string
  name: string
  description: string | null
}

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PersonaSelector } from '@/components/PersonaSelector'
import { Users, Bot, Settings, Send, MessageSquarePlus, X } from 'lucide-react'

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

interface RoomBot {
  id: string
  name: string
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
  const [activeBots, setActiveBots] = useState<RoomBot[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)

  // UI States
  const [showSidebar, setShowSidebar] = useState(true)
  const [showBotModal, setShowBotModal] = useState(false)

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

      // Fetch bots for this room
      const botResp = await fetch(`/api/chat-rooms/${roomId}/bots`)
      if (botResp.ok) {
        const bots = await botResp.json()
        setActiveBots(Array.isArray(bots) ? bots : [])
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

  // Mock function for adding a bot
  const handleAddBot = async (botId: string) => {
    if (activeBots.length >= 5) return alert("Maximum of 5 bots allowed per room.")
    // await fetch(`/api/chat-rooms/${roomId}/bots`, { method: 'POST', body: JSON.stringify({ botId }) })
    // Update local state temporarily for preview
    setActiveBots(prev => [...prev, { id: botId, name: 'New Universe Bot', avatar_url: null }])
    setShowBotModal(false)
  }

  const handleRemoveBot = async (botId: string) => {
    // await fetch(`/api/chat-rooms/${roomId}/bots/${botId}`, { method: 'DELETE' })
    setActiveBots(prev => prev.filter(b => b.id !== botId))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center text-gray-400 gap-4">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p>Syncing narrative...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0B0E14] text-gray-100 overflow-hidden font-sans">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Sleek Header */}
        <header className="flex-shrink-0 h-16 px-6 border-b border-gray-800/60 bg-[#11151C]/80 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-4 truncate">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <span className="font-bold text-white tracking-wider">{room?.name?.charAt(0) || 'R'}</span>
            </div>
            <div className="truncate">
              <h1 className="text-lg font-bold text-white truncate">{room?.name || 'Unknown Zone'}</h1>
              <p className="text-xs text-gray-400 truncate">{room?.description || 'A nexus of storylines'}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors md:hidden text-gray-400"
          >
            <Users size={20} />
          </button>
        </header>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth custom-scrollbar">
          {sortedMessages.map((message, i) => {
            const mine = message.sender_id === userId
            const personaName = message.personas?.name || 'Unknown entity'
            const personaAvatar = message.personas?.avatar_url
            const showHeader = i === 0 || sortedMessages[i-1].sender_id !== message.sender_id || sortedMessages[i-1].persona_id !== message.persona_id

            return (
              <div key={message.id} className={`flex w-full ${mine ? 'justify-end' : 'justify-start'} group`}>
                <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  {showHeader ? (
                    <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center mt-1">
                      {personaAvatar ? (
                        <img src={personaAvatar} alt={personaName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-400">{personaName.charAt(0)}</span>
                      )}
                    </div>
                  ) : <div className="w-9 flex-shrink-0" /> /* Spacer for grouped messages */}

                  {/* Message Bubble */}
                  <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <span className="text-sm font-semibold text-gray-200">{personaName}</span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                      mine 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-[#1C212B] text-gray-100 border border-gray-800 rounded-tl-sm'
                    }`}>
                      <p className="break-words whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Integrated Input Area */}
        <div className="p-4 bg-[#0B0E14] border-t border-gray-800/60 z-10 relative">
          {sendError && (
            <div className="absolute -top-10 left-4 right-4 text-xs text-red-200 bg-red-900/60 backdrop-blur border border-red-800 rounded-lg px-3 py-2 text-center shadow-lg">
              {sendError}
            </div>
          )}
          
          <div className="max-w-5xl mx-auto bg-[#161B22] rounded-2xl border border-gray-700/50 p-2 shadow-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            
            {/* Context/Persona Bar above input */}
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-800/50">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-medium text-gray-500">Speaking as:</span>
                <div className="scale-90 origin-left">
                  {/* Use your existing PersonaSelector here. You may want to strip its background in its own component so it blends in */}
                  <PersonaSelector selectedPersonaId={selectedPersonaId} onSelectPersona={handleSelectPersona} />
                </div>
              </div>
              <span className="text-[10px] text-gray-600 hidden sm:block tracking-wide">
                CYCLES AT 12/6 AM/PM EST
              </span>
            </div>

            <div className="flex items-end gap-2 px-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Weave your narrative..."
                className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none py-3 px-2 text-[15px] text-gray-100 placeholder-gray-500 focus:outline-none scrollbar-hide"
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !text.trim()}
                className="mb-1 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors group"
              >
                <Send size={18} className={`transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform ${sending ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Info, Members & Bots */}
      <div className={`${showSidebar ? 'w-72' : 'w-0'} flex-shrink-0 bg-[#11151C] border-l border-gray-800/60 transition-all duration-300 overflow-y-auto hidden md:flex flex-col`}>
        
        <div className="p-5 border-b border-gray-800/60">
          <h2 className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-4 flex items-center gap-2">
            <Bot size={16} /> 
            Universe Bots <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-300">{activeBots.length}/5</span>
          </h2>
          
          <div className="space-y-2">
            {activeBots.map(bot => (
              <div key={bot.id} className="flex items-center justify-between group p-2 rounded-lg hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-6 h-6 rounded bg-indigo-900/50 flex items-center justify-center text-indigo-400 text-xs font-bold border border-indigo-500/30">
                    {bot.name.charAt(0)}
                  </div>
                  <span className="text-sm text-gray-200 truncate">{bot.name}</span>
                </div>
                <button onClick={() => handleRemoveBot(bot.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            ))}
            
            {activeBots.length < 5 && (
              <button 
                onClick={() => setShowBotModal(true)}
                className="w-full mt-2 py-2 px-3 rounded-lg border border-dashed border-gray-700 text-gray-400 text-sm hover:border-indigo-500 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquarePlus size={16} />
                Summon Bot
              </button>
            )}
          </div>
        </div>

        <div className="p-5 flex-1">
          <h2 className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-4 flex items-center gap-2">
            <Users size={16} /> Active Cast ({members.length})
          </h2>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center gap-3 p-1">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-300">{member.username?.charAt(0) || 'U'}</span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#11151C] rounded-full"></div>
                </div>
                <div className="truncate flex-1">
                  <p className="text-sm font-medium text-gray-200 truncate">{member.username || 'Anonymous'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simple Bot Selection Modal Overlay */}
      {showBotModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Summon to Universe</h3>
              <button onClick={() => setShowBotModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Select a character from this universe's roster to integrate into the narrative. (Limit 5 per room)</p>
            
            {/* Mock List of available bots */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {['Aria (Sci-Fi)', 'Grog (Fantasy)', 'The Detective (Noir)'].map((mockBot, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleAddBot(`mock-id-${idx}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-900/50 hover:bg-indigo-600/20 border border-transparent hover:border-indigo-500/50 transition-all text-left"
                >
                  <Bot size={20} className="text-indigo-400" />
                  <span className="text-gray-200 font-medium">{mockBot}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
