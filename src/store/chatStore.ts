import { create } from 'zustand'
import { Chat, ChatMessage, Persona } from '@/types'

interface ChatState {
  activeChat: Chat | null
  messages: ChatMessage[]
  selectedPersona: Persona | null
  loading: boolean
  setActiveChat: (chat: Chat | null) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setSelectedPersona: (persona: Persona | null) => void
  setLoading: (loading: boolean) => void
  clearChat: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeChat: null,
  messages: [],
  selectedPersona: null,
  loading: false,
  setActiveChat: (chat) => set({ activeChat: chat }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  setSelectedPersona: (persona) => set({ selectedPersona: persona }),
  setLoading: (loading) => set({ loading }),
  clearChat: () =>
    set({
      activeChat: null,
      messages: [],
      selectedPersona: null,
    }),
}))
