'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface UserBotConversation {
  id: string
  updated_at?: string
  persona_id: string | null
  bots?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
  personas: {
    id: string
    name: string
    avatar_url: string | null
  } | null
  chat_messages: { id: string; created_at: string }[]
}

interface GroupConversation {
  id: string
  name: string
  updated_at?: string
  created_at?: string
  group_chat_members?: { count: number }[]
}

interface ConversationListItem {
  id: string
  kind: 'user-bot' | 'group'
  href: string
  title: string
  subtitle: string
  countLabel: string
  sortDate: string
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasUser, setHasUser] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()

  const loadConversations = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.push('/login')
        return
      }

      const headers = { Authorization: `Bearer ${session.access_token}` }

      const [userBotResp, groupResp] = await Promise.all([
        fetch('/api/chats', { headers }),
        fetch('/api/group-chats?scope=mine', { headers }),
      ])

      const userBotRows: UserBotConversation[] = userBotResp.ok ? await userBotResp.json() : []
      const groupRows: GroupConversation[] = groupResp.ok ? await groupResp.json() : []

      const userBotItems: ConversationListItem[] = userBotRows.map((conv) => ({
        id: conv.id,
        kind: 'user-bot',
        href: `/chat/${conv.id}`,
        title: conv.bots?.name || `Conversation ${conv.id.slice(0, 8)}`,
        subtitle: conv.personas ? `As ${conv.personas.name}` : 'As yourself',
        countLabel: `${conv.chat_messages?.length || 0} messages`,
        sortDate:
          conv.updated_at ||
          conv.chat_messages?.[conv.chat_messages.length - 1]?.created_at ||
          new Date(0).toISOString(),
      }))

      const groupItems: ConversationListItem[] = groupRows.map((group) => ({
        id: group.id,
        kind: 'group',
        href: `/group-chats/${group.id}`,
        title: group.name || `Group ${group.id.slice(0, 8)}`,
        subtitle: 'Group chat',
        countLabel: `${group.group_chat_members?.[0]?.count ?? 0} members`,
        sortDate: group.updated_at || group.created_at || new Date(0).toISOString(),
      }))

      const merged = [...userBotItems, ...groupItems].sort(
        (a, b) => +new Date(b.sortDate) - +new Date(a.sortDate)
      )

      setConversations(merged)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      setHasUser(true)
      await loadConversations()
    }

    initPage()
  }, [loadConversations, router])

  const formatActivityDate = (isoDate: string) => {
    const date = new Date(isoDate)
    return date.toLocaleDateString()
  }

  const handleDeleteConversation = async (conversation: ConversationListItem) => {
    const isGroupConversation = conversation.kind === 'group'
    const confirmed = window.confirm(
      isGroupConversation
        ? 'Leave this group conversation?'
        : 'Delete this conversation? This will permanently remove all messages.'
    )

    if (!confirmed) {
      return
    }

    setDeletingId(conversation.id)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.push('/login')
        return
      }

      const endpoint = isGroupConversation
        ? `/api/group-chats/${conversation.id}/join`
        : `/api/chats/${conversation.id}`

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to remove conversation')
      }

      setConversations((prev) => prev.filter((item) => item.id !== conversation.id))
    } catch (error) {
      console.error('Failed to remove conversation:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove conversation')
    } finally {
      setDeletingId(null)
    }
  }

  if (!hasUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Conversations</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">Continue your existing chats</p>
          </div>
          <Link
            href="/explore"
            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition font-medium shadow-lg hover:shadow-xl whitespace-nowrap text-center"
          >
            New Chat
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm sm:text-base">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-gray-600">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-gray-300 mb-4 sm:mb-6 text-base sm:text-lg">No conversations yet</p>
            <Link
              href="/explore"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition font-medium text-sm sm:text-base"
            >
              Start your first conversation
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="group p-4 sm:p-5 bg-gradient-to-r from-gray-800 to-gray-850 rounded-lg border border-gray-700 hover:border-blue-600 transition transform hover:scale-[1.02] shadow-md hover:shadow-lg"
              >
                <div className="flex gap-3 sm:gap-4 items-start">
                  <Link href={conv.href} className="flex gap-3 sm:gap-4 items-start flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm sm:text-lg">
                        {conv.kind === 'group' ? 'G' : 'C'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="font-semibold text-base sm:text-lg text-white group-hover:text-blue-300 transition truncate">
                          {conv.title}
                        </h2>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            conv.kind === 'group'
                              ? 'bg-purple-900/40 border-purple-700 text-purple-200'
                              : 'bg-blue-900/40 border-blue-800 text-blue-200'
                          }`}
                        >
                          {conv.kind === 'group' ? 'Group' : 'Bot'}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5 truncate">
                        {conv.subtitle}
                      </p>
                      <div className="flex gap-2 text-xs text-gray-500 mt-1">
                        <span className="truncate">{conv.countLabel}</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">{formatActivityDate(conv.sortDate)}</span>
                      </div>
                    </div>
                    <div className="text-gray-600 group-hover:text-blue-400 transition flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </Link>
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(conv)}
                      disabled={deletingId === conv.id}
                      className="px-3 py-1.5 text-xs sm:text-sm border border-red-800 text-red-300 rounded-md hover:bg-red-900/30 hover:border-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingId === conv.id
                        ? 'Removing...'
                        : conv.kind === 'group'
                        ? 'Leave'
                        : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
