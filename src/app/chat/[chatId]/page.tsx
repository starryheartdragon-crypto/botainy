'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChatWindow } from '@/components/ChatWindow'
import { Bot } from '@/types'

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const chatId = params.chatId as string

  const [bot, setBot] = useState<Bot | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initChat = async () => {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      // Load chat and bot info
      try {
        const resp = await fetch(`/api/chats/${chatId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (!resp.ok) {
          router.push('/conversations')
          return
        }

        const chat = (await resp.json()) as {
          id: string
          persona_id?: string | null
          bot?: {
            id: string
            name: string
            avatar_url: string | null
            personality: string | null
          } | null
        }

        if (!chat || !chat.bot) {
          router.push('/conversations')
          return
        }

        setBot({
          id: chat.bot.id,
          creatorId: '',
          name: chat.bot.name,
          universe: null,
          description: '',
          personality: chat.bot.personality || '',
          avatarUrl: chat.bot.avatar_url,
          isPublished: true,
          createdAt: '',
          updatedAt: '',
        } as Bot)
        setSelectedPersonaId(chat.persona_id ?? null)
      } catch (error) {
        console.error('Failed to load chat:', error)
        router.push('/conversations')
      } finally {
        setLoading(false)
      }
    }

    initChat()
  }, [chatId, router])

  if (loading || !bot || !userId) {
    if (!loading) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <p className="text-gray-400">Unable to load chat. Redirecting...</p>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Loading chat...</p>
      </div>
    )
  }

  return (
    <ChatWindow
      chatId={chatId}
      bot={bot}
      userId={userId}
      initialSelectedPersonaId={selectedPersonaId}
    />
  )
}
