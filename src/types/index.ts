export interface User {
  id: string
  email: string
  username: string
  birthday: string | null
  avatarUrl: string | null
  bio: string | null
  pronouns: string | null
  location: string | null
  accentColor: string | null
  interestTags: string[]
  createdAt: string
  updatedAt: string
}

export interface ExampleDialogue {
  user: string
  bot: string
}

export interface Bot {
  id: string
  creatorId: string
  name: string
  universe: string | null
  description: string
  personality: string
  appearance: string | null
  sourceExcerpts: string | null
  exampleDialogues: ExampleDialogue[] | null
  characterQuotes: string[] | null
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

// ── Badges & Leaderboards ──────────────────────────────────────────────────

export type BadgeCategory =
  | 'elite_storytelling'
  | 'community_pillars'
  | 'silly_flavor'
  | 'infamous_spicy'
  | 'event'

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
  category: BadgeCategory
  iconUrl: string | null
  isEvent: boolean
  eventId: string | null
  reputationPoints: number
  isActive: boolean
  createdAt: string
}

export interface BadgeEvent {
  id: string
  name: string
  description: string | null
  startsAt: string
  endsAt: string
  isActive: boolean
  createdAt: string
}

/** A badge copy in a user's inventory (ungifted) */
export interface BadgeInventoryItem {
  id: string
  userId: string
  badgeId: string
  gifted: boolean
  earnedAt: string
  badge?: Badge
}

/** A badge a user has received (from a gift or system award) */
export interface ReceivedBadge {
  id: string
  recipientId: string
  gifterId: string | null
  badgeId: string
  inventoryId: string | null
  message: string | null
  receivedAt: string
  badge?: Badge
  gifter?: { id: string; username: string; avatarUrl: string | null }
}

/** Up to 3 pinned received badges shown on a profile card */
export interface PinnedBadge {
  userId: string
  receivedId: string
  position: 1 | 2 | 3
  received?: ReceivedBadge
}

export interface UserReputation {
  userId: string
  allTime: number
  monthly: number
  monthlyYear: number
  monthlyMonth: number
  updatedAt: string
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  score: number
  snapshotAt: string
  user?: { id: string; username: string; avatarUrl: string | null }
}
