/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { ChatMessage, Bot } from '@/types'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { PersonaSelector } from './PersonaSelector'
import { SoundtrackDrawer } from './SoundtrackDrawer'

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
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(initialSelectedPersonaId)
  const [personaAvatarUrl, setPersonaAvatarUrl] = useState<string | null>(null)
  const [personaName, setPersonaName] = useState<string | null>(null)
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [apiTemperature, setApiTemperature] = useState(0.7)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // AI Assist handler
  const handleAiAssist = async (userInput: string) => {
    // Find previous bot message
    const lastBotMsg = [...messages].reverse().find(m => m.senderId === bot.id)?.content || '';
    const persona = selectedPersonaId ? { name: personaName, description: '' } : null;
    try {
      const headers = await getAuthHeaders(true);
      const resp = await fetch(`/api/chats/ai-complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatHistory: `${lastBotMsg}\nUser: ${userInput}`,
          persona,
        }),
      });
      if (!resp.ok) return userInput;
      const data = await resp.json();
      return typeof data.suggestion === 'string' ? data.suggestion : userInput;
    } catch {
      return userInput;
    }
  };

  // SoundtrackDrawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiTracks, setAiTracks] = useState<Track[]>([]);
  const [userTracks, setUserTracks] = useState<Track[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  type Track = {
    title: string;
    youtubeId: string;
    reasoning: string;
    addedBy: 'User' | 'AI';
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    toast.success('Summary copied!');
  };

  const handleGetSummary = async () => {
    if (messages.length < 15) return;
    setLoading(true);
    try {
      const storyPrompt = `Summarize the following chat as a story:\n\n${messages.slice(-15).map(m => `${m.senderId === userId ? 'User' : 'Bot'}: ${m.content}`).join('\n')}`;
      const { sendChatMessage } = await import('@/lib/openrouter');
      const response = await sendChatMessage({
        model: 'openai/gpt-4-turbo',
        messages: [
          { role: 'system', content: 'You are a creative storyteller. Summarize the chat as a story.' },
          { role: 'user', content: storyPrompt }
        ],
        temperature: apiTemperature,
        max_tokens: 512
      });
      const summary = response.choices[0]?.message?.content || 'No summary available.';
      setSummaryText(summary);
      setSummaryModalOpen(true);
      toast.success('Summary generated!');
    } catch (error) {
      toast.error('Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const headers = await getAuthHeaders(true);
      const resp = await fetch(`/api/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ botId: bot.id }),
      });
      if (resp.ok) {
        toast.success('New chat created!');
        setSettingsModalOpen(false);
      }
    } catch (error) {
      toast.error('Failed to create new chat.');
    }
  };

  const handleCloseSettings = () => setSettingsModalOpen(false);

  const fetchAiTracks = () => {
    setAiTracks([
      {
        title: 'Synthwave Dream',
        youtubeId: 'dQw4w9WgXcQ',
        reasoning: 'Perfect for the dramatic tension.',
        addedBy: 'AI',
      },
      {
        title: 'Cyberpunk Vibes',
        youtubeId: 'jNQXAC9IVRw',
        reasoning: 'Anachronistic fit for the mood.',
        addedBy: 'AI',
      },
      {
        title: 'Cinematic Score Example',
        youtubeId: 'V-_O7nl0Ii0',
        reasoning: 'Wild card for dramatic effect.',
        addedBy: 'AI',
      },
    ]);
  };

  const handleOpenDrawer = () => {
    fetchAiTracks();
    setDrawerOpen(true);
  };
  const handleCloseDrawer = () => setDrawerOpen(false);
  const handleAddUserTrack = (track: Track) => setUserTracks((prev) => [...prev, track]);
  const handleSelectTrack = (track: Track) => setSelectedTrack(track);

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

  // Load persona profile for avatar display
  useEffect(() => {
    let mounted = true
    const fetchPersonaProfile = async () => {
      if (!selectedPersonaId) {
        setPersonaAvatarUrl(null)
        setPersonaName(null)
        return
      }
      try {
        const headers = await getAuthHeaders()
        const resp = await fetch(`/api/personas/${selectedPersonaId}`, { headers })
        if (resp.ok && mounted) {
          const data = await resp.json() as { name?: string | null; avatarUrl?: string | null }
          setPersonaAvatarUrl(data.avatarUrl ?? null)
          setPersonaName(data.name ?? null)
        }
      } catch {
        // non-critical, leave defaults
      }
    }
    void fetchPersonaProfile()
    return () => { mounted = false }
  }, [selectedPersonaId])

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
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-950 relative">
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
        userAvatarUrl={personaAvatarUrl}
        userUsername={personaName}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        loading={loading}
        onAiAssist={handleAiAssist}
        lastBotMessage={messages.length ? messages[messages.length - 1].content : ''}
      />

      {/* Magic Wand Icon - Top Right, under NotificationBell */}
      <button
        onClick={handleOpenDrawer}
        className="fixed top-20 right-8 z-40 p-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg flex items-center text-3xl"
        title="Suggest Soundtrack"
        style={{ boxShadow: '0 4px 24px rgba(128,0,192,0.3)' }}
      >
        <span role="img" aria-label="Magic Wand">🪄</span>
      </button>

      {/* Soundtrack Drawer */}
      <SoundtrackDrawer
        aiTracks={aiTracks}
        userTracks={userTracks}
        onAddUserTrack={handleAddUserTrack}
        onSelectTrack={handleSelectTrack}
        selectedTrack={selectedTrack}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={() => setSummaryModalOpen(false)}>✖</button>
            <h2 className="text-xl font-bold mb-4">Chat Summary</h2>
            <textarea readOnly value={summaryText} className="w-full h-40 p-2 border rounded mb-4 text-sm bg-gray-100" />
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded mb-2" onClick={handleCopySummary}>Copy Summary</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={handleCloseSettings}>✖</button>
            <h2 className="text-xl font-bold mb-4">Chat Settings</h2>
            <div className="space-y-4">
              {/* New Chat */}
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded" onClick={handleNewChat}>New Chat</button>
              {/* Get Summary */}
              <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded" disabled={messages.length < 15 || loading} onClick={handleGetSummary}>Get Summary (Story)</button>
              {/* API Settings */}
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Temperature</label>
                <input type="range" min="0" max="2" step="0.01" value={apiTemperature} onChange={e => setApiTemperature(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-gray-600 mt-1">Current: {apiTemperature}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
