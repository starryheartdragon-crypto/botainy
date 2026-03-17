export interface User {
  id: string
  email: string
  username: string
  birthday: string | null
  avatarUrl: string | null
  bio: string | null
  createdAt: string
  updatedAt: string
}

export interface Bot {
  id: string
  creatorId: string
  name: string
  universe: string | null
  description: string
  personality: string
  avatarUrl: string | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface Persona {
  id: string
  userId: string
  name: string
  description: string
  avatarUrl: string | null
  createdAt: string
}

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  content: string
  createdAt: string
}

export interface Chat {
  id: string
  participantIds: string[]
  botIds: string[]
  isGroupChat: boolean
  roomId?: string
  is_nsfw: boolean
  createdAt: string
  updatedAt: string
}

export interface MusicTrack {
  id: string
  userId: string
  title: string
  artistName: string
  url: string
  duration: number
  order: number
  uploadedAt: string
}
