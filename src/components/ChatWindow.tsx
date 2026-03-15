'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { ChatMessage, Bot } from '@/types'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { PersonaSelector } from './PersonaSelector'

type MessagePayload = ChatMessage & {
  chat_id?: string
  sender_id?: string
  created_at?: string
}

interface ChatWindowProps {
  chatId: string
  bot: Bot
  userId: string
  initialSelectedPersonaId?: string | null
}

export function ChatWindow({ chatId, bot, userId, initialSelectedPersonaId = null }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  // ...existing code...
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(initialSelectedPersonaId)
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [userUsername, setUserUsername] = useState<string | null>(null)
  // ...existing code...

  const normalizeMessage = useCallback((message: MessagePayload): ChatMessage => ({
    id: message.id,
    chatId: message.chatId ?? message.chat_id ?? '',
    senderId: message.senderId ?? message.sender_id ?? '',
    content: message.content,
    createdAt: message.createdAt ?? message.created_at ?? new Date().toISOString(),
  }), [])

  const upsertMessages = useCallback((incomingMessages: MessagePayload[]) => {
    if (!incomingMessages.length) return

    const normalized = incomingMessages.map(normalizeMessage)

    setMessages((prev) => {
      const map = new Map<string, ChatMessage>()

      for (const message of prev) {
        map.set(message.id, message)
      }

      for (const message of normalized) {
        map.set(message.id, message)
      }

      return Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })
  }, [normalizeMessage])

  useEffect(() => {
    setSelectedPersonaId(initialSelectedPersonaId)
  }, [initialSelectedPersonaId])

  const getAuthHeaders = async (includeJson = false) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers: Record<string, string> = {}
    if (includeJson) {
      headers['Content-Type'] = 'application/json'
    }
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    return headers
  }

  const loadMessages = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const resp = await fetch(`/api/chats/${chatId}/messages`, { headers, cache: 'no-store' })
      if (resp.ok) {
        const data = (await resp.json()) as MessagePayload[]
        setMessages(data.map(normalizeMessage))
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }, [chatId, normalizeMessage])

  // Subscribe to new messages in real-time
  const subscribeToMessages = useCallback(() => {
    const subscription = supabase
      .channel(`chat:${chatId}`)
      // Handle new messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as MessagePayload
          upsertMessages([newMessage])
        }
      )
      // Handle edited messages
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as MessagePayload
          upsertMessages([updatedMessage])
        }
      )
      // Handle deleted messages
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const deletedMessage = payload.old as ChatMessage
          setMessages((prev) => prev.filter((msg) => msg.id !== deletedMessage.id))
        }
      )
      .subscribe()

    return () => {
      void subscription.unsubscribe()
    }
  }, [chatId, upsertMessages])

  // Load initial messages
  useEffect(() => {
    loadMessages()
    const unsubscribe = subscribeToMessages()
    const intervalId = window.setInterval(() => {
      void loadMessages()
    }, 4000)

    return () => {
      window.clearInterval(intervalId)
      unsubscribe()
    }
  }, [loadMessages, subscribeToMessages])

  // Load user profile for avatar display
  useEffect(() => {
    let mounted = true
    const fetchUserProfile = async () => {
      try {
        const headers = await getAuthHeaders()
        const resp = await fetch('/api/profile', { headers })
        if (resp.ok && mounted) {
          const data = await resp.json() as { username?: string | null; avatar_url?: string | null }
          setUserAvatarUrl(data.avatar_url ?? null)
          setUserUsername(data.username ?? null)
        }
      } catch {
        // non-critical, leave defaults
      }
    }
    void fetchUserProfile()
    return () => { mounted = false }
  }, [userId])

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const headers = await getAuthHeaders(true)
      const resp = await fetch(`/api/chats/messages/${messageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ content }),
      })

      if (!resp.ok) {
        throw new Error('Failed to edit message')
      }

      // Message will update via real-time subscription
    } catch (error) {
      console.error('Error editing message:', error)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const headers = await getAuthHeaders()
      const resp = await fetch(`/api/chats/messages/${messageId}`, {
        method: 'DELETE',
        headers,
      })

      if (!resp.ok) {
        throw new Error('Failed to delete message')
      }

      // Message will be removed via real-time subscription
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const handleSendMessage = async (content: string) => {
    try {
      setLoading(true)
      const headers = await getAuthHeaders(true)
      const resp = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, personaId: selectedPersonaId }),
      })

      if (!resp.ok) {
        const rawBody = await resp.text().catch(() => '')
        let parsedBody: unknown = null

        if (rawBody) {
          try {
            parsedBody = JSON.parse(rawBody)
          } catch {
            parsedBody = rawBody
          }
        }

        const payload = parsedBody as Record<string, unknown> | null
        const payloadError =
          payload && typeof payload === 'object' && typeof payload.error === 'string'
            ? payload.error
            : null
        const payloadMessage =
          payload && typeof payload === 'object' && typeof payload.message === 'string'
            ? payload.message
            : null

        const fallback = `Request failed with status ${resp.status}${resp.statusText ? ` ${resp.statusText}` : ''}`
        const message = payloadError || payloadMessage || fallback
        const responseBody = parsedBody ?? (rawBody || null)

        console.warn('Failed to send message:', {
          status: resp.status,
          message,
          body: responseBody,
        })

        if (resp.status === 401) {
          toast.error('Your session has expired. Please sign in again.')
        } else {
          toast.error(message)
        }

        return
      }

      const data = (await resp.json()) as {
        userMessage?: MessagePayload | null
        botMessage?: MessagePayload | null
        warning?: string
      }

      const newMessages: MessagePayload[] = []
      if (data.userMessage) {
        newMessages.push(data.userMessage)
      }
      if (data.botMessage) {
        newMessages.push(data.botMessage)
      }

      if (newMessages.length) {
        upsertMessages(newMessages)
      }

      if (data.warning) {
        toast.error(data.warning)
      }
    } catch (error) {
      console.warn('Error sending message:', error)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      {/* ...existing code... */}
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-950 border-b border-gray-800 px-3 sm:px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
          {bot.avatarUrl ? (
            <Image
              src={bot.avatarUrl}
              alt={bot.name}
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-gray-700 shadow-md flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-sm sm:text-lg flex-shrink-0">
              {bot.name?.[0] || 'B'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{bot.name}</h1>
            <p className="text-xs sm:text-sm text-gray-400">Character Bot</p>
          </div>
        </div>
      </div>

      {/* Persona Selector */}
      <PersonaSelector
        selectedPersonaId={selectedPersonaId}
        onSelectPersona={setSelectedPersonaId}
      />

      {/* Messages */}
      <MessageList 
        messages={messages} 
        userId={userId} 
        bot={bot}
        loading={loading}
        userAvatarUrl={userAvatarUrl}
        userUsername={userUsername}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
      />

      {/* Input */}
      <MessageInput onSendMessage={handleSendMessage} loading={loading} />
    </div>
  )
}
