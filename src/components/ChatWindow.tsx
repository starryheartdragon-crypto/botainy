/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { ChatMessage, Bot } from '@/types'
import { useAuthStore } from '@/store/authStore'
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
  const [relationshipContext, setRelationshipContext] = useState<string>('')
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [apiTemperature, setApiTemperature] = useState(0.9)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  // NSFW toggle state
  const { user } = useAuthStore()
  const [isNsfw, setIsNsfw] = useState(false)
  const [savingNsfw, setSavingNsfw] = useState(false)
  // Load chat NSFW state
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const headers = await getAuthHeaders()
        const resp = await fetch(`/api/chats/${chatId}`, { headers })
        if (resp.ok) {
          const data = await resp.json()
          setIsNsfw(!!data.is_nsfw)
          setRelationshipContext(data.relationship_context ?? '')
          if (typeof data.api_temperature === 'number') {
            setApiTemperature(data.api_temperature)
          }
        }
      } catch {}
    }
    fetchChat()
  }, [chatId])
  // Save NSFW toggle
  const handleToggleNsfw = async () => {
    setSavingNsfw(true)
    try {
      const headers = await getAuthHeaders(true)
      const resp = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_nsfw: !isNsfw }),
      })
      if (resp.ok) {
        setIsNsfw(!isNsfw)
        toast.success(`Chat is now ${!isNsfw ? 'NSFW' : 'SFW'}`)
      } else {
        toast.error('Failed to update NSFW setting')
      }
    } catch {
      toast.error('Failed to update NSFW setting')
    } finally {
      setSavingNsfw(false)
    }
  }

  // Save relationship context on blur
  const handleRelationshipSave = async (value: string) => {
    try {
      const headers = await getAuthHeaders(true)
      await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ relationship_context: value.trim() || null }),
      })
    } catch {
      // non-critical
    }
  }

  // AI Assist handler
  const handleAiAssist = async (userInput: string) => {
    // Find the last bot message for context
    const lastBotMsg = [...messages].reverse().find(m => m.senderId === bot.id)?.content || '';
    const persona = selectedPersonaId ? { name: personaName, description: '' } : null;
    try {
      const headers = await getAuthHeaders(true);
      const resp = await fetch(`/api/chats/ai-complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lastBotMessage: lastBotMsg,
          userDraft: userInput,
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
      const { sendChatMessageWithFallback } = await import('@/lib/openrouter');
      const response = await sendChatMessageWithFallback({
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

  const handleCloseSettings = () => setSettingsModalOpen(false)

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const headers = await getAuthHeaders(true)
      const resp = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ api_temperature: apiTemperature }),
      })
      if (resp.ok) {
        toast.success('Settings saved!')
        setSettingsModalOpen(false)
      } else {
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  };

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
    setSelectedPersonaId(selectedPersonaId)
  }, [selectedPersonaId])

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
      setLoading(true);
      const headers = await getAuthHeaders(true);
      const resp = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, personaId: selectedPersonaId }),
      });
      if (!resp.ok) {
        const fallback = `Request failed with status ${resp.status}${resp.statusText ? ` ${resp.statusText}` : ''}`;
        const message = fallback;
        const responseBody = await resp.text();
        console.warn('Failed to send message:', {
          status: resp.status,
          message,
          body: responseBody,
        });
        if (resp.status === 401) {
          toast.error('Your session has expired. Please sign in again.');
        } else {
          toast.error(message);
        }
        return;
      }
      const data = (await resp.json()) as {
        userMessage?: MessagePayload | null;
        botMessage?: MessagePayload | null;
        warning?: string;
      };
      const newMessages: MessagePayload[] = [];
      if (data.userMessage) {
        newMessages.push(data.userMessage);
      }
      if (data.botMessage) {
        newMessages.push(data.botMessage);
      }
      if (newMessages.length) {
        upsertMessages(newMessages);
      }
      if (data.warning) {
        toast.error(data.warning);
      }
    } catch (error) {
      console.warn('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
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
        botName={bot.name}
        relationshipContext={relationshipContext}
        onRelationshipChange={setRelationshipContext}
        onRelationshipSave={handleRelationshipSave}
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

      {/* Settings Button */}
      <button
        onClick={() => setSettingsModalOpen(true)}
        className="fixed top-20 right-24 z-40 p-4 rounded-full bg-gray-700 hover:bg-gray-800 text-white shadow-lg flex items-center text-3xl"
        title="Chat Settings"
        style={{ boxShadow: '0 4px 24px rgba(64,64,64,0.3)' }}
      >
        <span role="img" aria-label="Settings">⚙️</span>
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
          <div className="bg-gray-900 rounded-lg shadow-xl p-6 w-96 relative border border-gray-700">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-200" onClick={handleCloseSettings}>✖</button>
            <h2 className="text-xl font-bold mb-4 text-white">Chat Settings</h2>
            <div className="space-y-4">
              {/* New Chat */}
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded" onClick={handleNewChat}>New Chat</button>
              {/* Get Summary */}
              <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded" disabled={messages.length < 15 || loading} onClick={handleGetSummary}>Get Summary (Story)</button>
              {/* NSFW Toggle & Warning Tooltip */}
              <div className="relative group flex items-center gap-2 ml-auto cursor-help mb-4">
                <span className="text-xs font-bold text-gray-300">{isNsfw ? 'NSFW' : 'SFW'}</span>
                <button 
                  onClick={handleToggleNsfw}
                  disabled={savingNsfw}
                  className={`w-11 h-6 rounded-full transition-colors relative ${isNsfw ? 'bg-red-600' : 'bg-gray-700'}`}
                  aria-pressed={isNsfw}
                >
                  <div className={`w-4 h-4 rounded-full bg-gray-200 absolute top-1 transition-transform ${isNsfw ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                {/* The Hoverbox (Hidden by default, shown on group-hover) */}
                <div className="absolute right-0 top-full mt-3 hidden group-hover:block w-64 p-3.5 bg-gray-950 border border-red-900/50 rounded-xl shadow-2xl z-50 pointer-events-none">
                  <div className="absolute -top-2 right-4 w-4 h-4 bg-gray-950 border-t border-l border-red-900/50 transform rotate-45" />
                  <h4 className="text-red-400 font-bold text-sm mb-1.5 flex items-center gap-1.5">
                    ⚠️ Unfiltered Content
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
                <label className="block text-sm font-medium mb-2 text-gray-200">Temperature</label>
                <input type="range" min="0" max="2" step="0.01" value={apiTemperature} onChange={e => setApiTemperature(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-gray-400 mt-1">Current: {apiTemperature}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="bg-gray-700 text-gray-200 px-4 py-2 rounded hover:bg-gray-600" onClick={handleCloseSettings}>Cancel</button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60" onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
