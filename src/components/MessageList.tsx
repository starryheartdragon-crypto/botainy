'use client'

import Image from 'next/image'
import { ChatMessage as ChatMessageType } from '@/types'
import { useEffect, useRef, useState } from 'react'
import { Bot } from '@/types'

interface MessageListProps {
  messages: ChatMessageType[]
  userId: string
  bot: Bot
  loading?: boolean
  userAvatarUrl?: string | null
  userUsername?: string | null
  onEditMessage?: (messageId: string, content: string) => Promise<void>
  onDeleteMessage?: (messageId: string) => Promise<void>
}

function FormattedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const pattern = /(\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*)/g
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else {
      parts.push(<em key={key++}>{match[3]}</em>)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts.length > 0 ? parts : text}</>
}

export function MessageList({ 
  messages, 
  userId, 
  bot,
  loading,
  userAvatarUrl,
  userUsername,
  onEditMessage,
  onDeleteMessage,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [isNearBottom, setIsNearBottom] = useState(true)

  const isScrolledNearBottom = () => {
    const container = containerRef.current
    if (!container) return true

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceFromBottom <= 96
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom()
    }
  }, [isNearBottom, messages])

  const handleContainerScroll = () => {
    setIsNearBottom(isScrolledNearBottom())
  }

  const handleEditStart = (msg: ChatMessageType) => {
    setEditingId(msg.id)
    setEditText(msg.content)
  }

  const handleEditSave = async (messageId: string) => {
    if (!editText.trim()) return
    try {
      await onEditMessage?.(messageId, editText.trim())
      setEditingId(null)
    } catch (err) {
      console.error('Failed to edit message:', err)
    }
  }

  const handleDelete = async (messageId: string) => {
    if (!confirm('Delete this message?')) return
    try {
      await onDeleteMessage?.(messageId)
    } catch (err) {
      console.error('Failed to delete message:', err)
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleContainerScroll}
      className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 bg-gradient-to-b from-gray-900 to-gray-950"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-4">
            <p className="text-gray-400 text-base sm:text-lg">Start a conversation with the bot</p>
            <p className="text-gray-500 text-sm mt-2">Type a message below to begin</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg) => {
            const isUser = msg.senderId === userId
            const isEditing = editingId === msg.id

            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2 sm:gap-3 group`}>
                {!isUser && (
                  bot.avatarUrl ? (
                    <Image
                      src={bot.avatarUrl}
                      alt={bot.name}
                      width={32}
                      height={32}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-gray-700 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      {bot.name?.[0] || 'B'}
                    </div>
                  )
                )}
                <div className={`flex flex-col max-w-[85%] sm:max-w-xs md:max-w-md ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && <span className="text-xs text-gray-500 px-1 mb-1">{bot.name}</span>}
                  <div
                    className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl transition-all ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-none shadow-lg'
                        : 'bg-gray-800 text-gray-100 rounded-bl-none shadow-md'
                    } ${isEditing ? 'ring-2 ring-yellow-500' : ''}`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full p-2 bg-gray-700 text-white rounded text-xs sm:text-sm border border-gray-600 focus:border-yellow-500 focus:outline-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSave(msg.id)}
                            className="px-2 sm:px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 sm:px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm break-words whitespace-pre-wrap">
                        <FormattedText text={msg.content} />
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1 px-1 gap-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {isUser && !isEditing && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        <button
                          onClick={() => handleEditStart(msg)}
                          className="text-xs px-2 py-0.5 hover:bg-blue-700 rounded text-blue-200 transition"
                          title="Edit message"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="text-xs px-2 py-0.5 hover:bg-red-700 rounded text-red-200 transition"
                          title="Delete message"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {isUser && (
                  userAvatarUrl ? (
                    <Image
                      src={userAvatarUrl}
                      alt={userUsername ?? 'You'}
                      width={32}
                      height={32}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-gray-700 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      {userUsername?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )
                )}
              </div>
            )
          })}
          {loading && (
            <div className="flex justify-start gap-2 sm:gap-3">
              {bot.avatarUrl ? (
                <Image
                  src={bot.avatarUrl}
                  alt={bot.name}
                  width={32}
                  height={32}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-gray-700 flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                  {bot.name?.[0] || 'B'}
                </div>
              )}
              <div className="bg-gray-800 text-gray-100 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl rounded-bl-none shadow-md">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
