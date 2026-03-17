'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PersonaSelector } from '@/components/PersonaSelector'

interface GroupMessage {
  id: string
  group_chat_id: string
  sender_id: string
  content: string
  created_at: string
  sender_is_bot?: boolean
  sender_name?: string | null
  sender_avatar_url?: string | null
}

interface GroupChatInfo {
  id: string
  name: string
  description: string | null
  creator_id: string
}

export default function GroupChatDetailPage() {
  const params = useParams()
  const router = useRouter()
  const groupChatId = params.groupChatId as string

  const [group, setGroup] = useState<GroupChatInfo | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
  const [relationshipContextInput, setRelationshipContextInput] = useState('')
  const [savingJoinProfile, setSavingJoinProfile] = useState(false)
  const [joinProfileMessage, setJoinProfileMessage] = useState<string | null>(null)
  const [membershipLoaded, setMembershipLoaded] = useState(false)
  const [membershipHasProfile, setMembershipHasProfile] = useState(false)

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiTemperature, setApiTemperature] = useState(1.0)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryText, setSummaryText] = useState('')

  // NSFW toggle state
  const [isNsfw, setIsNsfw] = useState(false)
  const [savingNsfw, setSavingNsfw] = useState(false)

  // Load group NSFW state
  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const resp = await fetch(`/api/group-chats/${groupChatId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (resp.ok) {
          const data = await resp.json()
          setIsNsfw(!!data.is_nsfw)
        }
      } catch {}
    }
    fetchGroup()
  }, [groupChatId])

  // Save NSFW toggle
  const handleToggleNsfw = async () => {
    setSavingNsfw(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const resp = await fetch(`/api/group-chats/${groupChatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_nsfw: !isNsfw }),
      })
      if (resp.ok) {
        setIsNsfw(!isNsfw)
        alert(`Group chat is now ${!isNsfw ? 'NSFW' : 'SFW'}`)
      } else {
        alert('Failed to update NSFW setting')
      }
    } catch {
      alert('Failed to update NSFW setting')
    } finally {
      setSavingNsfw(false)
    }
  }

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText)
    alert('Summary copied!')
  }

  const handleNewChat = () => {
    setMessages([])
    alert('Chat reset!')
  }

  const handleGetSummary = async () => {
    if (messages.length < 15) return
    try {
      const storyPrompt = `Summarize the following group chat as a story:\n\n${messages.slice(-15).map(m => `${m.sender_id === userId ? 'User' : m.sender_name || 'Bot'}: ${m.content}`).join('\n')}`
      const { sendChatMessage } = await import('@/lib/openrouter')
      const response = await sendChatMessage({
        model: 'openai/gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are a creative storyteller. Summarize the group chat as a story.' },
          { role: 'user', content: storyPrompt }
        ],
        temperature: apiTemperature,
        max_tokens: 512
      })
      const summary = response.choices[0]?.message?.content || 'No summary available.'
      setSummaryText(summary)
      setSummaryModalOpen(true)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      alert('Failed to generate summary.')
    }
  }

  const getInitials = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return 'B'
    return trimmed.slice(0, 2).toUpperCase()
  }

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages]
  )

  const upsertMessages = (incomingMessages: GroupMessage[]) => {
    if (!incomingMessages.length) return
    setMessages((prev) => {
      const map = new Map<string, GroupMessage>()
      for (const message of prev) {
        map.set(message.id, message)
      }
      for (const message of incomingMessages) {
        const existing = map.get(message.id)
        if (existing) {
          map.set(message.id, {
            ...existing,
            ...message,
            sender_is_bot:
              typeof message.sender_is_bot === 'boolean'
                ? message.sender_is_bot
                : existing.sender_is_bot,
            sender_name: message.sender_name ?? existing.sender_name,
            sender_avatar_url: message.sender_avatar_url ?? existing.sender_avatar_url,
          })
        } else {
          map.set(message.id, message)
        }
      }
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })
  }

  const fetchMessages = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const msgResp = await fetch(`/api/group-chats/${groupChatId}/messages`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })

    if (!msgResp.ok) return
    const data = await msgResp.json()
    upsertMessages(Array.isArray(data) ? data : [])
  }, [groupChatId])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !session.access_token) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      const memberResp = await fetch(`/api/group-chats/${groupChatId}/members/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (memberResp.ok) {
        const memberData = await memberResp.json() as { persona_id?: string | null, relationship_context?: string | null }
        setSelectedPersonaId(memberData.persona_id ?? null)
        setMembershipLoaded(true)
        setMembershipHasProfile(Boolean(memberData.persona_id) || Boolean(memberData.relationship_context))
      }

      const groupResp = await fetch('/api/group-chats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (groupResp.ok) {
        const allGroups = await groupResp.json()
        const current = (allGroups || []).find((g: GroupChatInfo) => g.id === groupChatId)
        setGroup(current || null)
      }

      const msgResp = await fetch(`/api/group-chats/${groupChatId}/messages`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      })

      if (msgResp.status === 403) {
        router.push('/group-chats')
        return
      }

      if (msgResp.ok) {
        const data = await msgResp.json()
        upsertMessages(Array.isArray(data) ? data : [])
      }

      setLoading(false)
    }

    init()
  }, [groupChatId, router])

  useEffect(() => {
    const channel = supabase
      .channel(`group-chat:${groupChatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_chat_messages', filter: `group_chat_id=eq.${groupChatId}` },
        (payload) => {
          upsertMessages([payload.new as GroupMessage])
        }
      )
      .subscribe()

    const intervalId = window.setInterval(() => {
      void fetchMessages()
    }, 4000)

    return () => {
      window.clearInterval(intervalId)
      channel.unsubscribe()
    }
  }, [fetchMessages, groupChatId])

  const sendMessage = async () => {
    const content = text.trim()
    if (!content) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    try {
      setSending(true)
      const resp = await fetch(`/api/group-chats/${groupChatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content, personaId: selectedPersonaId }),
      })

      if (resp.ok) {
        const data = await resp.json().catch(() => null)
        if (data && typeof data === 'object') {
          const warning = (data as { bot_warning?: unknown }).bot_warning
          if (typeof warning === 'string' && warning.trim()) {
            console.warn('Group bot response warning:', warning)
          }

          const typed = data as {
            userMessage?: GroupMessage
            botMessage?: GroupMessage | null
            botMessages?: GroupMessage[]
          }

          if (typed.userMessage) {
            const returnedBotMessages = Array.isArray(typed.botMessages)
              ? typed.botMessages.filter((message): message is GroupMessage => Boolean(message?.id))
              : typed.botMessage
                ? [typed.botMessage]
                : []

            upsertMessages([typed.userMessage, ...returnedBotMessages])
          } else {
            upsertMessages([data as GroupMessage])
          }
        }
        setText('')
      }
    } finally {
      setSending(false)
    }
  }

  const saveJoinProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setJoinProfileMessage('Please log in again to save your profile.')
      return
    }

    try {
      setSavingJoinProfile(true)
      setJoinProfileMessage(null)

      const resp = await fetch(`/api/group-chats/${groupChatId}/members/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          personaId: selectedPersonaId,
          relationshipContext: relationshipContextInput.trim(),
          appendRelationshipContext: true,
        }),
      })

      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        const message =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: unknown }).error || 'Failed to save join profile')
            : 'Failed to save join profile'
        throw new Error(message)
      }

      setRelationshipContextInput('')
      setJoinProfileMessage('Saved. Your persona and relationship context were updated.')
    } catch (err) {
      setJoinProfileMessage(err instanceof Error ? err.message : 'Failed to save join profile')
    } finally {
      setSavingJoinProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading group chat...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex flex-col relative">
      <div className="border-b border-gray-800 px-4 sm:px-6 py-4 bg-gray-950/80 relative">
        <h1 className="text-lg sm:text-xl font-semibold">{group?.name || 'Group Chat'}</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">{group?.description || 'Private group conversation'}</p>
        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="absolute top-4 right-6 z-40 p-3 rounded-full bg-gray-700 hover:bg-gray-800 text-white shadow-lg text-2xl"
          title="Group Chat Settings"
        >
          <span role="img" aria-label="Settings">⚙️</span>
        </button>
      </div>

      {/* Show join profile UI only for non-creators and only if membership profile not set */}
      {membershipLoaded && group && userId && group.creator_id !== userId && !membershipHasProfile && (
        <>
          <PersonaSelector
            selectedPersonaId={selectedPersonaId}
            onSelectPersona={setSelectedPersonaId}
          />
          <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-gray-800 bg-gray-900/70 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-100">Join Profile</h2>
            <p className="mt-1 text-xs text-gray-400">
              Set your persona for this group and add relationship/context notes so the group narrative includes you correctly.
            </p>
            <textarea
              value={relationshipContextInput}
              onChange={(e) => setRelationshipContextInput(e.target.value)}
              placeholder="Example: My persona is allied with Bot A, distrusts Bot B, and is secretly seeking a truce."
              className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
              rows={3}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={saveJoinProfile}
                disabled={savingJoinProfile}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingJoinProfile ? 'Saving...' : 'Save Join Profile'}
              </button>
              {joinProfileMessage ? <span className="text-xs text-gray-300">{joinProfileMessage}</span> : null}
            </div>
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3">
        {sortedMessages.map((message) => {
          const mine = message.sender_id === userId
          const showAvatar = true
          const senderLabel = message.sender_name || (message.sender_is_bot ? 'Bot' : 'User')
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-2 max-w-[90%] sm:max-w-lg ${mine ? 'flex-row-reverse' : ''}`}>
                {showAvatar ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 border border-gray-600 shrink-0">
                    {mine && selectedPersonaId && message.sender_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.sender_avatar_url ?? undefined}
                        alt={senderLabel}
                        className="w-full h-full object-cover"
                      />
                    ) : (!mine && message.sender_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.sender_avatar_url ?? undefined}
                        alt={senderLabel}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-200 font-semibold">
                        {getInitials(senderLabel)}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className={`px-4 py-2 rounded-2xl text-sm ${mine ? 'bg-blue-600 rounded-br-none' : 'bg-gray-800 rounded-bl-none'}`}>
                  {!mine && message.sender_name ? (
                    <p className={`text-[11px] mb-1 font-medium ${message.sender_is_bot ? 'text-blue-300' : 'text-emerald-300'}`}>
                      {message.sender_name}
                    </p>
                  ) : null}
                  <p className="break-words">{message.content}</p>
                  <p className="text-[10px] text-gray-300 mt-1">
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-800 p-3 sm:p-4 bg-gray-950">
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
            placeholder="Message group..."
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
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-gray-900 rounded-lg shadow-xl p-6 w-96 relative border border-gray-700">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-200" onClick={() => setSettingsOpen(false)}>&#10006;</button>
            <h2 className="text-xl font-bold mb-4 text-white">Group Chat Settings</h2>
            <div className="space-y-4">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded" onClick={handleNewChat}>New Chat</button>
              <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded" disabled={messages.length < 15} onClick={handleGetSummary}>Get Summary (Story)</button>
              {/* NSFW Toggle & Warning Tooltip */}
              <div className="relative group flex items-center gap-2 ml-auto cursor-help mb-4">
                <span className="text-xs font-bold text-gray-400">{isNsfw ? 'NSFW' : 'SFW'}</span>
                <button
                  onClick={handleToggleNsfw}
                  disabled={savingNsfw}
                  className={`w-11 h-6 rounded-full transition-colors relative ${isNsfw ? 'bg-red-600' : 'bg-gray-600'}`}
                  aria-pressed={isNsfw}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isNsfw ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                {/* The Hoverbox (Hidden by default, shown on group-hover) */}
                <div className="absolute right-0 top-full mt-3 hidden group-hover:block w-64 p-3.5 bg-gray-950 border border-red-900/50 rounded-xl shadow-2xl z-50 pointer-events-none">
                  <div className="absolute -top-2 right-4 w-4 h-4 bg-gray-950 border-t border-l border-red-900/50 transform rotate-45" />
                  <h4 className="text-red-400 font-bold text-sm mb-1.5 flex items-center gap-1.5">
                    &#9888;&#65039; Unfiltered Content
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Enabling NSFW removes AI safety filters. This allows explicit romance and &quot;spicy&quot; content, but also permits graphic blood, gore, and dark themes.
                  </p>
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      Use at your own risk. We are not liable for generated content.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-200 mb-2">Temperature</label>
                <input type="range" min="0" max="2" step="0.01" value={apiTemperature} onChange={e => setApiTemperature(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-gray-400 mt-1">Current: {apiTemperature}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={() => setSummaryModalOpen(false)}>&#10006;</button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Group Chat Summary</h2>
            <textarea readOnly value={summaryText} className="w-full h-40 p-2 border rounded mb-4 text-sm bg-gray-100 text-gray-900" />
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded mb-2" onClick={handleCopySummary}>Copy Summary</button>
          </div>
        </div>
      )}
    </div>
  )
}
