'use client'

import { useState } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  loading?: boolean
  onAiAssist?: (userInput: string) => Promise<string>
  lastBotMessage?: string
}

export function MessageInput({ onSendMessage, loading }: MessageInputProps) {
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 bg-gray-950 border-t border-gray-800">
      <div className="flex gap-2 sm:gap-3 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Shift+Enter to send)"
          disabled={loading}
          rows={1}
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 text-sm sm:text-base text-white rounded-2xl border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-30 disabled:opacity-50 transition resize-none overflow-hidden"
          style={{ minHeight: '44px', maxHeight: '200px' }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm sm:text-base rounded-full hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-md hover:shadow-lg whitespace-nowrap"
        >
          {loading ? '...' : 'Send'}
        </button>
        {/* AI Assist Button */}
        {typeof onAiAssist === 'function' && (
          <button
            type="button"
            disabled={aiLoading || loading}
            className="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs sm:text-sm rounded-full hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-md hover:shadow-lg whitespace-nowrap"
            style={{ minWidth: 44 }}
            title="AI Assist"
            onClick={async () => {
              if (aiLoading || loading) return;
              setAiLoading(true);
              try {
                const suggestion = await onAiAssist(input);
                if (suggestion && suggestion.length > 0) setInput(suggestion);
              } finally {
                setAiLoading(false);
              }
            }}
          >
            {aiLoading ? '...' : 'AI Assist'}
          </button>
        )}
      </div>
    </form>
  )
}
