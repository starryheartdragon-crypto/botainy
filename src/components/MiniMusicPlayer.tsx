'use client'

import { useEffect, useRef } from 'react'
import { useMusicStore } from '@/store/musicStore'

// ── YouTube IFrame API types ──────────────────────────────────────────────
interface YTPlayerOptions {
  height?: number | string
  width?: number | string
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: YTPlayerInstance }) => void
    onStateChange?: (e: { data: number }) => void
  }
}

interface YTPlayerInstance {
  loadVideoById(videoId: string): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
}

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement | string, opts: YTPlayerOptions) => YTPlayerInstance
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

const YT_ENDED = 0

// ── Helper: load the YouTube IFrame script once ───────────────────────────
let ytScriptLoaded = false
function loadYTScript() {
  if (ytScriptLoaded) return
  ytScriptLoaded = true
  const s = document.createElement('script')
  s.src = 'https://www.youtube.com/iframe_api'
  s.async = true
  document.head.appendChild(s)
}

// ── Relationship score label (reused from RelationshipContextPanel) ───────
function scoreLabel(score: number): string {
  if (score <= -76) return 'Archrivals'
  if (score <= -51) return 'Bitter Enemies'
  if (score <= -26) return 'Rivals'
  if (score <= -11) return 'Cold Strangers'
  if (score <= 10) return 'Neutral'
  if (score <= 25) return 'Acquaintances'
  if (score <= 50) return 'Friends'
  if (score <= 75) return 'Close Friends'
  if (score <= 90) return 'Deeply Bonded'
  if (score <= 99) return 'Devoted'
  return 'Lovers'
}
void scoreLabel // suppress unused-warning for now

export function MiniMusicPlayer() {
  const tracks = useMusicStore((s) => s.tracks)
  const currentIndex = useMusicStore((s) => s.currentIndex)
  const isPlaying = useMusicStore((s) => s.isPlaying)
  const sourceLabel = useMusicStore((s) => s.sourceLabel)
  const { next, prev, toggle } = useMusicStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const playerReadyRef = useRef(false)
  // Track last loaded videoId so we don't reload unnecessarily
  const loadedIdRef = useRef<string | null>(null)

  const currentTrack = tracks[currentIndex] ?? null

  // ── Load YT script once ──────────────────────────────────────────────────
  useEffect(() => {
    loadYTScript()
  }, [])

  // ── Create / refresh player when track changes ───────────────────────────
  useEffect(() => {
    if (!currentTrack?.youtubeId || !containerRef.current) return

    const videoId = currentTrack.youtubeId

    const initPlayer = () => {
      if (playerRef.current && playerReadyRef.current) {
        if (loadedIdRef.current !== videoId) {
          loadedIdRef.current = videoId
          playerRef.current.loadVideoById(videoId)
        }
        return
      }

      if (playerRef.current) return // still initialising

      // Re-create the inner container div because YouTube replaces it
      const container = containerRef.current!
      container.innerHTML = ''
      const inner = document.createElement('div')
      container.appendChild(inner)

      playerReadyRef.current = false
      loadedIdRef.current = videoId

      playerRef.current = new window.YT.Player(inner, {
        height: '48',
        width: '80',
        videoId,
        playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            playerReadyRef.current = true
            if (useMusicStore.getState().isPlaying) {
              playerRef.current?.playVideo()
            } else {
              playerRef.current?.pauseVideo()
            }
          },
          onStateChange: (e) => {
            if (e.data === YT_ENDED) useMusicStore.getState().next()
          },
        },
      })
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        initPlayer()
      }
    }
  }, [currentTrack?.youtubeId])

  // ── Sync play / pause state ───────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current || !playerReadyRef.current) return
    if (isPlaying) {
      playerRef.current.playVideo()
    } else {
      playerRef.current.pauseVideo()
    }
  }, [isPlaying])

  return (
    /* Always rendered so the YouTube iframe container is kept alive */
    <div
      className={`fixed bottom-4 right-4 z-[60] transition-all duration-300 ${
        tracks.length === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="bg-gray-900/95 border border-gray-700 rounded-2xl shadow-2xl flex items-center gap-2 overflow-hidden pr-2">
        {/* YouTube iframe lives here — must stay in DOM */}
        <div
          ref={containerRef}
          className="w-[80px] h-[48px] flex-shrink-0 overflow-hidden rounded-l-2xl bg-black"
        />

        {/* Track info */}
        <div className="flex flex-col min-w-0 flex-1 max-w-[140px] py-2">
          {sourceLabel && (
            <p className="text-[10px] text-gray-500 truncate leading-none mb-0.5">
              🎵 {sourceLabel}
            </p>
          )}
          <p className="text-xs text-white truncate font-medium leading-tight">
            {currentTrack?.title ?? 'Unknown Track'}
          </p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">
            {currentIndex + 1}&thinsp;/&thinsp;{tracks.length}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={prev}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title="Previous"
          >
            ⏮
          </button>
          <button
            onClick={toggle}
            className="p-1.5 text-white hover:text-gray-200 rounded transition-colors text-base"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
          <button
            onClick={next}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title="Next"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  )
}
