'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
        map.set(message.id, message)
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
        body: JSON.stringify({ content }),
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading group chat...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex flex-col">
      <div className="border-b border-gray-800 px-4 sm:px-6 py-4 bg-gray-950/80">
        <h1 className="text-lg sm:text-xl font-semibold">{group?.name || 'Group Chat'}</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">{group?.description || 'Private group conversation'}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3">
        {sortedMessages.map((message) => {
          const mine = message.sender_id === userId
          const showAvatar = !mine
          const senderLabel = message.sender_name || (message.sender_is_bot ? 'Bot' : 'User')
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-2 max-w-[90%] sm:max-w-lg ${mine ? 'flex-row-reverse' : ''}`}>
                {showAvatar ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 border border-gray-600 shrink-0">
                    {message.sender_avatar_url ? (
                      <img
                        src={message.sender_avatar_url}
                        alt={senderLabel}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-200 font-semibold">
                        {getInitials(senderLabel)}
                      </div>
                    )}
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
    </div>
  )
}
