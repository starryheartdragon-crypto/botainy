'use client'

import { create } from 'zustand'

export interface MusicTrack {
  title: string
  youtubeId: string
}

interface MusicState {
  tracks: MusicTrack[]
  currentIndex: number
  isPlaying: boolean
  sourceLabel: string | null
  setPlaylist: (tracks: MusicTrack[], label?: string) => void
  setTrack: (index: number) => void
  next: () => void
  prev: () => void
  play: () => void
  pause: () => void
  toggle: () => void
}

export function extractYouTubeId(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    const v = u.searchParams.get('v')
    if (v) return v
  } catch {
    // not a URL — might already be a bare ID
  }
  // Bare ID passthrough (11 chars, alphanumeric + -_)
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url
  return ''
}

export const useMusicStore = create<MusicState>((set, get) => ({
  tracks: [],
  currentIndex: 0,
  isPlaying: false,
  sourceLabel: null,

  setPlaylist: (tracks, label) =>
    set({ tracks, currentIndex: 0, isPlaying: true, sourceLabel: label ?? null }),

  setTrack: (index) => set({ currentIndex: index, isPlaying: true }),

  next: () => {
    const { tracks, currentIndex } = get()
    if (!tracks.length) return
    set({ currentIndex: (currentIndex + 1) % tracks.length, isPlaying: true })
  },

  prev: () => {
    const { tracks, currentIndex } = get()
    if (!tracks.length) return
    set({ currentIndex: (currentIndex - 1 + tracks.length) % tracks.length, isPlaying: true })
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
}))
