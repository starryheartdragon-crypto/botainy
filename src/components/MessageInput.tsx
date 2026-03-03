'use client'

import { useState } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  loading?: boolean
}

export function MessageInput({ onSendMessage, loading }: MessageInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6 bg-gray-950 border-t border-gray-800">
      <div className="flex gap-2 sm:gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-900 text-sm sm:text-base text-white rounded-full border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-30 disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm sm:text-base rounded-full hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-md hover:shadow-lg whitespace-nowrap"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </form>
  )
}
