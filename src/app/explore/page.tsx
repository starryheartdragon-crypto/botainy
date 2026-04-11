"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { BOT_UNIVERSES, UNIVERSE_CATEGORIES } from "@/lib/botUniverses"
import { PersonaPromptModal } from "@/components/PersonaPromptModal"

type RelationStatus = "none" | "pending_incoming" | "pending_outgoing" | "connected"

type ExploreBot = {
  id: string
  name: string
  description: string
  personality: string
  avatar_url: string | null
  creator_id: string
  universe: string | null
}

type CreatorBadge = {
  username: string | null
  isAdmin: boolean
  connectionsCount: number
  relationStatus: RelationStatus
}

type NarrativeNpc = {
  name: string
  role: string
  motive: string
  publicFace: string
  hiddenAgenda?: string
  relationship: {
    affection: number
    suspicion: number
    fear: number
  }
}

type NarrativePayload = {
  title: string
  worldState: {
    setting: string
    vibe: string
    techLevel: string
    immediateStakes: string
    pressure: string
  }
  npcs: NarrativeNpc[]
  incitingIncident: {
    scene: string
  }
  director: {
    openingBeat: string
    sensoryDetails: string
    tensionClock: string
  }
  dialogueStarter: {
    speaker: string
    line: string
  }
  sceneCardPrompt: string
}

type RelationshipMeters = Record<string, { affection: number; suspicion: number; fear: number }>

type RoleplayMessage = {
  id: string
  role: 'director' | 'npc' | 'user'
  speaker: string
  text: string
}

type NarrativeTurnResponse = {
  directorText: string
  npcReplies: Array<{ name: string; line: string }>
  nextSituation: string
  relationshipEffects: Record<string, { affection?: number; suspicion?: number; fear?: number }>
  updatedTensionClock: string
  sceneCardPrompt?: string
}

type DynamicEventResponse = {
  groupChatId: string
  groupName: string
  createdBots: Array<{ id: string; name: string }>
  error?: string
}

const UNIVERSE_EMOJIS: Record<string, string> = {
  // Anime & Animation
  "Attack on Titan": "⚔️",
  "Avatar: The Last Airbender": "🌊",
  "DragonBall": "🐉",
  "Jujutsu Kaisen": "🌀",
  "Naruto": "🍃",
  "One Piece": "⚓",
  "Sailor moon": "🌙",
  "Studio Ghibli": "🌿",
  // Crime, Action & Drama
  "Better Call Saul": "⚖️",
  "Boardwalk Empire": "🎩",
  "Breaking Bad": "⚗️",
  "Bridgerton": "💌",
  "Indiana Jones": "🎒",
  "James Bond": "🕵️",
  "John Wick": "🐕",
  "Mission: Impossible": "💼",
  "Peaky Blinders": "🎩",
  "Ripper Street": "🔍",
  "Sherlock Holmes": "🔍",
  "The Sopranos": "🍝",
  "The Wire": "📡",
  // Fantasy & Magic
  "GoT/HotD/KotSK": "🐉",
  "His Dark Materials": "🌌",
  "Lord of the Rings": "💍",
  "Masters of the Universe": "⚡",
  "Narnia": "🦁",
  "Pirates of the Caribbean": "🏴‍☠️",
  "The Immortals": "✨",
  "Twilight": "🧛",
  // Horror & Supernatural
  "Ghosts (BBC)": "👻",
  "Penny Dreadful": "🕯️",
  "Stephen King": "😱",
  "Supernatural": "🔮",
  "The Conjuring": "👁️",
  "The Walking Dead": "🧟",
  // Mythology & History
  "Celtic mythology": "🍀",
  "Egyptian mythology": "🏺",
  "Greek mythology": "🏛️",
  "Hindu mythology": "🕉️",
  "Historical figures": "📜",
  "Japanese mythology": "⛩️",
  "Norse mythology": "⚡",
  "Roman mythology": "🦅",
  "Slavic mythology": "🌲",
  // Sci-Fi & Dystopian
  "Alien": "👾",
  "Avatar (James Cameron)": "🌿",
  "Blade Runner": "🌆",
  "Doctor Who": "⏰",
  "Dune": "🏜️",
  "Foundation": "🌌",
  "Jurassic Park": "🦕",
  "MonsterVerse (Godzilla/Kong)": "🦖",
  "Planet of the Apes": "🐒",
  "Startrek": "🖖",
  "Starwars": "🚀",
  "Stranger Things": "🔦",
  "Terminator": "🤖",
  "The Hunger Games": "🏹",
  "The Matrix": "💊",
  "The Maze Runner": "🌿",
  "The X-Files": "👽",
  // Superheroes & Comics
  "DC": "🦇",
  "Invincible": "🟡",
  "Marvel": "⚡",
  "The Boys": "🩸",
  // Video Games & Tabletop
  "Arcane/League of Legends": "⚗️",
  "Assassin's Creed": "🦅",
  "Castlevania": "🦇",
  "CoD": "🎖️",
  "cyberpunk": "🌆",
  "dishonored": "🗡️",
  "Elden Ring": "☀️",
  "Fallout": "☢️",
  "Final Fantasy": "⚔️",
  "Halo (Game series)": "🪖",
  "Mass Effect": "🌌",
  "MTG": "🃏",
  "Resident Evil": "🧟",
  "TTRPG": "🎲",
  "The Elder Scrolls": "🐉",
  "The Witcher": "⚔️",
  // General / Original
  "OC (Original Character)": "✨",
  "Sinners": "😈",
  "Other": "🌐",
}

const NARRATIVE_GENRES = [
  'High Fantasy',
  'Gritty Sci-Fi',
  'Historical Drama',
  'Cyberpunk',
  'Cozy Slice-of-Life',
] as const

const NARRATIVE_STAKES = [
  'Low (Personal/Social)',
  'Medium (City-wide)',
  'High (World-ending)',
] as const

const NARRATIVE_CONFLICTS = [
  'Political Intrigue',
  'Combat/Action',
  'Romance',
  'Mystery/Investigation',
] as const

const NARRATIVE_VIBES = ['Dark', 'Humorous', 'Hopeful', 'Melancholy'] as const

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getTtrpgRole(bot: ExploreBot): "NPC" | "DM" | "PC" | "Encounter" | null {
  if (bot.universe !== "TTRPG") return null

  const personality = bot.personality || ""
  if (personality.includes("TTRPG Role: DM")) return "DM"
  if (personality.includes("TTRPG Role: PC")) return "PC"
  if (personality.includes("TTRPG Role: NPC")) return "NPC"
  if (personality.includes("TTRPG Role: Encounter")) return "Encounter"

  if (bot.description.startsWith("TTRPG DM")) return "DM"
  if (bot.description.startsWith("TTRPG PC")) return "PC"
  if (bot.description.startsWith("TTRPG Encounter")) return "Encounter"
  return "NPC"
}

export default function ExplorePage() {
  const [bots, setBots] = useState<ExploreBot[]>([])
  const [nameSearch, setNameSearch] = useState("")
  const [universeFilter, setUniverseFilter] = useState("")
  const [sparkIdentity, setSparkIdentity] = useState('I am the Empress of Qin China.')
  const [sparkGoalContext, setSparkGoalContext] = useState('I want to root out a conspiracy in the palace.')
  const [sparkTone, setSparkTone] = useState('Cinematic, high-stakes, immersive')
  const [sparkGenreSetting, setSparkGenreSetting] = useState<string>('')
  const [sparkInitialStakes, setSparkInitialStakes] = useState<string>('')
  const [sparkConflictType, setSparkConflictType] = useState<string>('')
  const [sparkVibeKeyword, setSparkVibeKeyword] = useState<string>('')
  const [narrative, setNarrative] = useState<NarrativePayload | null>(null)
  const [relationshipMeters, setRelationshipMeters] = useState<RelationshipMeters>({})
  const [roleplayInput, setRoleplayInput] = useState('')
  const [roleplayMessages, setRoleplayMessages] = useState<RoleplayMessage[]>([])
  const [roleplayLoading, setRoleplayLoading] = useState(false)
  const [roleplayError, setRoleplayError] = useState<string | null>(null)
  const [dynamicEventLoading, setDynamicEventLoading] = useState(false)
  const [dynamicEventError, setDynamicEventError] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState<string | null>(null)
  const [loadingBots, setLoadingBots] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [personaPromptOpen, setPersonaPromptOpen] = useState(false)
  const [pendingBotId, setPendingBotId] = useState<string | null>(null)
  const [creatorBadges, setCreatorBadges] = useState<Record<string, CreatorBadge>>({})
  const router = useRouter()

  const groupedBots = useMemo(() => {
    const universeOrder = Object.values(UNIVERSE_CATEGORIES).flat() as string[]
    const groups: Record<string, ExploreBot[]> = {}
    for (const bot of bots) {
      const key = bot.universe ?? "Other"
      if (!groups[key]) groups[key] = []
      groups[key].push(bot)
    }
    const orderedKeys = [
      ...universeOrder.filter((u) => u in groups),
      ...Object.keys(groups).filter((k) => !universeOrder.includes(k)),
    ]
    return orderedKeys.map((universe) => ({ universe, bots: groups[universe] }))
  }, [bots])

  const loadCreatorBadges = useCallback(async (botRows: ExploreBot[]) => {
    const creatorIds = Array.from(new Set(botRows.map((bot) => bot.creator_id).filter(Boolean)))
    if (creatorIds.length === 0) {
      setCreatorBadges({})
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers: Record<string, string> = {}
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    const badgeResp = await fetch(`/api/users/badges?ids=${creatorIds.join(",")}`, { headers })
    if (!badgeResp.ok) return

    const badgeData = (await badgeResp.json()) as Array<{
      id: string
      username: string | null
      isAdmin: boolean
      connectionsCount: number
      relationStatus: RelationStatus
    }>

    const mapped: Record<string, CreatorBadge> = {}
    for (const entry of badgeData ?? []) {
      mapped[entry.id] = {
        username: entry.username,
        isAdmin: !!entry.isAdmin,
        connectionsCount: entry.connectionsCount,
        relationStatus: entry.relationStatus,
      }
    }

    setCreatorBadges(mapped)
  }, [])

  const loadBots = useCallback(
    async (name: string, universe: string) => {
      setLoadingBots(true)
      try {
        const params = new URLSearchParams()
        if (name.trim()) {
          params.set("name", name.trim())
        }
        if (universe) {
          params.set("universe", universe)
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        const headers: Record<string, string> = {}
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }

        const query = params.toString()
        const response = await fetch(query ? `/api/bots?${query}` : "/api/bots", { headers })
        const payload = (await response.json()) as { bots?: ExploreBot[]; error?: string }

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load bots")
        }

        const botRows = payload.bots ?? []
        setBots(botRows)
        await loadCreatorBadges(botRows)
      } catch (error) {
        console.error("Failed to load bots:", error)
        setBots([])
        setCreatorBadges({})
      } finally {
        setLoadingBots(false)
      }
    },
    [loadCreatorBadges]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadBots(nameSearch, universeFilter)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [loadBots, nameSearch, universeFilter])

  const relationLabel: Record<RelationStatus, string> = {
    none: "No connection",
    pending_incoming: "Requested you",
    pending_outgoing: "Request sent",
    connected: "Connected",
  }

  const meterBarClass: Record<'affection' | 'suspicion' | 'fear', string> = {
    affection: 'bg-emerald-500',
    suspicion: 'bg-amber-500',
    fear: 'bg-rose-500',
  }

  const createMessage = (role: RoleplayMessage['role'], speaker: string, text: string): RoleplayMessage => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    speaker,
    text,
  })

  const handleGenerateNarrative = async () => {
    setNarrativeError(null)
    setRoleplayError(null)
    setDynamicEventError(null)
    setRoleplayInput('')

    if (!sparkIdentity.trim() || !sparkGoalContext.trim()) {
      setNarrativeError('Please fill in both identity and goal/context.')
      return
    }

    try {
      setNarrativeLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setNarrativeError('Please log in to use the Dynamic Narrative Generator.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/narrative/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          identity: sparkIdentity,
          goalContext: sparkGoalContext,
          tone: sparkTone,
          genreSetting: sparkGenreSetting || undefined,
          initialStakes: sparkInitialStakes || undefined,
          conflictType: sparkConflictType || undefined,
          vibeKeyword: sparkVibeKeyword || undefined,
        }),
      })

      const payload = (await response.json()) as { narrative?: NarrativePayload; error?: string }

      if (!response.ok || !payload.narrative) {
        throw new Error(payload.error || 'Failed to generate narrative')
      }

      setNarrative(payload.narrative)

      const initialMeters: RelationshipMeters = {}
      for (const npc of payload.narrative.npcs) {
        initialMeters[npc.name] = {
          affection: clampMeter(npc.relationship.affection),
          suspicion: clampMeter(npc.relationship.suspicion),
          fear: clampMeter(npc.relationship.fear),
        }
      }
      setRelationshipMeters(initialMeters)

      setRoleplayMessages([
        createMessage('director', 'Director', payload.narrative.director.openingBeat),
        createMessage('director', 'Director', payload.narrative.incitingIncident.scene),
        createMessage('npc', payload.narrative.dialogueStarter.speaker, `“${payload.narrative.dialogueStarter.line}”`),
      ])
    } catch (error) {
      setNarrativeError(error instanceof Error ? error.message : 'Failed to generate narrative')
    } finally {
      setNarrativeLoading(false)
    }
  }

  const handleRoleplaySubmit = async () => {
    if (!narrative || !roleplayInput.trim()) return

    const userText = roleplayInput.trim()
    const nextMessages = [...roleplayMessages, createMessage('user', 'You', userText)]

    setRoleplayMessages(nextMessages)
    setRoleplayInput('')
    setRoleplayLoading(true)
    setRoleplayError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setRoleplayError('Please log in to continue roleplay.')
        router.push('/login')
        return
      }

      const history = nextMessages.slice(-10).map((message) => ({
        speaker: message.speaker,
        text: message.text,
        role: message.role,
      }))

      const response = await fetch('/api/narrative/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          narrative,
          relationshipMeters,
          userResponse: userText,
          history,
        }),
      })

      const payload = (await response.json()) as { turn?: NarrativeTurnResponse; error?: string }

      if (!response.ok || !payload.turn) {
        throw new Error(payload.error || 'Failed to continue roleplay turn')
      }

      const { turn } = payload

      setRelationshipMeters((current) => {
        const next: RelationshipMeters = { ...current }
        for (const [npcName, delta] of Object.entries(turn.relationshipEffects || {})) {
          const base = next[npcName] || { affection: 50, suspicion: 50, fear: 30 }
          next[npcName] = {
            affection: clampMeter(base.affection + (delta.affection ?? 0)),
            suspicion: clampMeter(base.suspicion + (delta.suspicion ?? 0)),
            fear: clampMeter(base.fear + (delta.fear ?? 0)),
          }
        }
        return next
      })

      setNarrative((current) => {
        if (!current) return current
        return {
          ...current,
          director: {
            ...current.director,
            tensionClock: turn.updatedTensionClock || current.director.tensionClock,
          },
          sceneCardPrompt: turn.sceneCardPrompt || current.sceneCardPrompt,
        }
      })

      const generatedMessages: RoleplayMessage[] = [
        createMessage('director', 'Director', turn.directorText),
        ...turn.npcReplies.map((reply) => createMessage('npc', reply.name, `“${reply.line}”`)),
        createMessage('director', 'Director', turn.nextSituation),
      ]

      setRoleplayMessages((current) => [...current, ...generatedMessages])
    } catch (error) {
      setRoleplayError(error instanceof Error ? error.message : 'Failed to continue roleplay turn')
    } finally {
      setRoleplayLoading(false)
    }
  }

  const handleLaunchDynamicEvent = async () => {
    if (!narrative) return

    try {
      setDynamicEventLoading(true)
      setDynamicEventError(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setDynamicEventError('Please log in to launch an AI group event.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/game/dynamic-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          narrative,
          groupName: `${narrative.title} - AI Group Event`,
          visibility: 'private',
        }),
      })

      const payload = (await response.json()) as DynamicEventResponse

      if (!response.ok || !payload.groupChatId) {
        throw new Error(payload.error || 'Failed to launch AI group event')
      }

      router.push(`/group-chats/${payload.groupChatId}`)
    } catch (error) {
      setDynamicEventError(error instanceof Error ? error.message : 'Failed to launch AI group event')
    } finally {
      setDynamicEventLoading(false)
    }
  }

  const resetRelationships = () => {
    if (!narrative) return
    const baseline: RelationshipMeters = {}
    for (const npc of narrative.npcs) {
      baseline[npc.name] = {
        affection: clampMeter(npc.relationship.affection),
        suspicion: clampMeter(npc.relationship.suspicion),
        fear: clampMeter(npc.relationship.fear),
      }
    }
    setRelationshipMeters(baseline)
  }

  const handleStartChat = async (botId: string, personaId: string | null, score: number, relationshipContext: string) => {
    try {
      setLoading(botId)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const resp = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ botId, personaId }),
      })

      if (!resp.ok) {
        const responseText = await resp.text()
        let apiError = 'Unknown error'

        try {
          const payload = JSON.parse(responseText) as { error?: string }
          apiError = payload?.error || apiError
        } catch {
          if (responseText.trim()) {
            apiError = responseText.slice(0, 300)
          }
        }

        console.error(
          `Failed to create chat (status=${resp.status}, contentType=${resp.headers.get('content-type') || 'unknown'}): ${apiError}`
        )
        return
      }

      const newChat = await resp.json()

      // Save the initial relationship data for this persona+chat if a persona was chosen
      if (personaId && (score !== 0 || relationshipContext.trim())) {
        try {
          const body: Record<string, unknown> = { relationship_score: score }
          if (relationshipContext.trim()) body.relationship_context = relationshipContext.trim()
          await fetch(
            `/api/chats/${newChat.id}/relationship?personaId=${encodeURIComponent(personaId)}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(body),
            }
          )
        } catch {
          // non-critical — user can adjust in chat
        }
      }

      router.push(`/chat/${newChat.id}`)
    } catch (error) {
      console.error('Error starting chat:', error)
    } finally {
      setLoading(null)
    }
  }

  const handleClickStartChat = (botId: string) => {
    setPendingBotId(botId)
    setPersonaPromptOpen(true)
  }

  const handleReport = async (targetType: 'bot' | 'user', targetId: string) => {
    const reason = window.prompt('Why are you reporting this?')?.trim() || ''
    if (!reason) return

    try {
      setReporting(`${targetType}:${targetId}`)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        alert(payload?.error || 'Failed to submit report')
        return
      }

      alert('Report submitted. Thanks for helping keep the community safe.')
    } catch (error) {
      console.error('Failed to submit report:', error)
      alert('Failed to submit report')
    } finally {
      setReporting(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col">
        <h1 className="text-3xl font-bold text-white mb-6">Explore Bots</h1>

        <div className="order-last mt-10 rounded-2xl border border-gray-700 bg-gray-800/50 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-white">Dynamic Narrative Generator</h2>
            <span className="text-xs px-2 py-1 rounded-full border border-indigo-700 bg-indigo-900/40 text-indigo-200">
              Explore Feature
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Identity</label>
              <input
                value={sparkIdentity}
                onChange={(e) => setSparkIdentity(e.target.value)}
                placeholder="I am the Empress of Qin China."
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Tone</label>
              <input
                value={sparkTone}
                onChange={(e) => setSparkTone(e.target.value)}
                placeholder="Cinematic, high-stakes, immersive"
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Genre / Setting (optional)</label>
              <select
                value={sparkGenreSetting}
                onChange={(e) => setSparkGenreSetting(e.target.value)}
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Auto</option>
                {NARRATIVE_GENRES.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Initial Stakes (optional)</label>
              <select
                value={sparkInitialStakes}
                onChange={(e) => setSparkInitialStakes(e.target.value)}
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Auto</option>
                {NARRATIVE_STAKES.map((stakes) => (
                  <option key={stakes} value={stakes}>
                    {stakes}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Conflict Type (optional)</label>
              <select
                value={sparkConflictType}
                onChange={(e) => setSparkConflictType(e.target.value)}
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Auto</option>
                {NARRATIVE_CONFLICTS.map((conflict) => (
                  <option key={conflict} value={conflict}>
                    {conflict}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Vibe Keyword (optional)</label>
              <select
                value={sparkVibeKeyword}
                onChange={(e) => setSparkVibeKeyword(e.target.value)}
                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Auto</option>
                {NARRATIVE_VIBES.map((vibe) => (
                  <option key={vibe} value={vibe}>
                    {vibe}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm text-gray-300 mb-1">Goal / Context</label>
            <textarea
              value={sparkGoalContext}
              onChange={(e) => setSparkGoalContext(e.target.value)}
              rows={3}
              placeholder="I want to root out a conspiracy in the palace."
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            onClick={handleGenerateNarrative}
            disabled={narrativeLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-full hover:from-indigo-700 hover:to-violet-800 disabled:opacity-60 transition font-medium"
          >
            {narrativeLoading ? 'Generating...' : 'Generate Narrative'}
          </button>

          {narrativeError && <p className="mt-3 text-sm text-rose-300">{narrativeError}</p>}

          {narrative && (
            <div className="mt-6 space-y-5">
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                  <h3 className="text-lg text-white font-semibold mb-3">{narrative.title}</h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400">Setting</p>
                      <p className="text-gray-200">{narrative.worldState.setting}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Vibe</p>
                      <p className="text-gray-200">{narrative.worldState.vibe}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Tech Level</p>
                      <p className="text-gray-200">{narrative.worldState.techLevel}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Immediate Stakes</p>
                      <p className="text-gray-200">{narrative.worldState.immediateStakes}</p>
                    </div>
                  </div>
                  <p className="text-sm text-amber-200 mt-3">Pressure: {narrative.worldState.pressure}</p>
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                  <h4 className="text-sm text-gray-300 mb-2">Scene Card</h4>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://image.pollinations.ai/prompt/${encodeURIComponent(narrative.sceneCardPrompt)}?width=768&height=512&nologo=true`}
                    alt="Generated scene card"
                    className="w-full h-44 object-cover rounded-lg border border-gray-700"
                  />
                  <p className="mt-2 text-xs text-gray-400">{narrative.sceneCardPrompt}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <h4 className="text-sm text-indigo-300 mb-2">Director Bot</h4>
                <p className="text-gray-200 text-sm">{narrative.director.openingBeat}</p>
                <p className="text-gray-400 text-xs mt-2">{narrative.director.sensoryDetails}</p>
                <p className="text-amber-200 text-xs mt-2">Tension Clock: {narrative.director.tensionClock}</p>
                <div className="mt-3 rounded-lg border border-gray-700 bg-gray-950/70 p-3">
                  <p className="text-xs text-gray-400 mb-1">Dialogue Channel</p>
                  <p className="text-sm text-gray-200">
                    <span className="text-blue-300">{narrative.dialogueStarter.speaker}:</span> “{narrative.dialogueStarter.line}”
                  </p>
                </div>

                <div className="mt-4 border-t border-gray-700 pt-3">
                  <button
                    onClick={handleLaunchDynamicEvent}
                    disabled={dynamicEventLoading}
                    className="px-4 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                  >
                    {dynamicEventLoading ? 'Launching group event...' : 'Jump Into AI Group Chat'}
                  </button>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Creates a private roleplay group chat with AI-generated cast bots and scenario rules.
                  </p>
                  {dynamicEventError && <p className="mt-2 text-xs text-rose-300">{dynamicEventError}</p>}
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm text-gray-300">NPC Ensemble & Relationship Tracking</h4>
                  <button
                    onClick={resetRelationships}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
                  >
                    Reset Meters
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {narrative.npcs.map((npc) => {
                    const meters = relationshipMeters[npc.name] || npc.relationship
                    return (
                      <div key={npc.name} className="rounded-lg border border-gray-700 bg-gray-950/60 p-3">
                        <p className="text-white font-medium">{npc.name}</p>
                        <p className="text-xs text-blue-300 mb-2">{npc.role}</p>
                        <p className="text-xs text-gray-300">{npc.motive}</p>
                        <p className="text-xs text-gray-400 mt-1">Public face: {npc.publicFace}</p>
                        {npc.hiddenAgenda && (
                          <p className="text-xs text-amber-200 mt-1">Hidden agenda: {npc.hiddenAgenda}</p>
                        )}
                        <div className="mt-3 space-y-2">
                          {(['affection', 'suspicion', 'fear'] as const).map((metric) => (
                            <div key={metric}>
                              <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                                <span className="capitalize">{metric}</span>
                                <span>{meters[metric]}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                <div
                                  className={`h-full ${meterBarClass[metric]} transition-all`}
                                  style={{ width: `${meters[metric]}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <h4 className="text-sm text-gray-300 mb-2">In-Character Roleplay</h4>

                <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-3 max-h-72 overflow-y-auto space-y-2">
                  {roleplayMessages.length === 0 && (
                    <p className="text-xs text-gray-500">Generate a narrative to begin your roleplay turn loop.</p>
                  )}
                  {roleplayMessages.map((message) => (
                    <div key={message.id} className="text-sm">
                      <span
                        className={
                          message.role === 'user'
                            ? 'text-emerald-300'
                            : message.role === 'npc'
                              ? 'text-blue-300'
                              : 'text-indigo-300'
                        }
                      >
                        {message.speaker}:
                      </span>
                      <span className="text-gray-200 ml-2">{message.text}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">Your in-character response</label>
                  <textarea
                    value={roleplayInput}
                    onChange={(e) => setRoleplayInput(e.target.value)}
                    rows={3}
                    placeholder="Write what your character says or does next..."
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={handleRoleplaySubmit}
                      disabled={!narrative || !roleplayInput.trim() || roleplayLoading}
                      className="px-4 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition"
                    >
                      {roleplayLoading ? 'Directing...' : 'Send In-Character Turn'}
                    </button>
                    <span className="text-xs text-amber-200">Tension Clock: {narrative.director.tensionClock}</span>
                  </div>
                  {roleplayError && <p className="mt-2 text-xs text-rose-300">{roleplayError}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Search by bot name"
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
          <select
            value={universeFilter}
            onChange={(e) => setUniverseFilter(e.target.value)}
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            <option value="">All universes</option>
            {Object.entries(UNIVERSE_CATEGORIES).map(([genre, universes]) => (
              <optgroup key={genre} label={genre}>
                {universes.map((universe) => (
                  <option key={universe} value={universe}>
                    {universe}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="space-y-10">
          {loadingBots && <div className="text-gray-400">Loading bots...</div>}
          {!loadingBots && bots.length === 0 && (
            <div className="text-gray-400">No bots match this name/universe search.</div>
          )}
          {!loadingBots && groupedBots.map(({ universe, bots: groupBots }) => (
            <div key={universe}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl" role="img" aria-label={universe}>{UNIVERSE_EMOJIS[universe] ?? "✨"}</span>
                <h2 className="text-lg font-bold text-white">{universe}</h2>
                <div className="flex-1 h-px bg-gray-700 ml-1" />
                <span className="text-xs text-gray-500">{groupBots.length} {groupBots.length === 1 ? "bot" : "bots"}</span>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
            {groupBots.map((b) => (
            <div key={b.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                {b.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.avatar_url} alt={b.name} className="w-12 h-12 rounded-md object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gray-700" />
                )}
                <div>
                  <div className="text-white font-semibold">{b.name}</div>
                  {b.universe && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-300">{b.universe}</span>
                      {getTtrpgRole(b) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-700 bg-purple-900/40 text-purple-200">
                          TTRPG • {getTtrpgRole(b)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-gray-400 flex items-center gap-1.5">
                    <span>by {creatorBadges[b.creator_id]?.username || b.creator_id}</span>
                    {creatorBadges[b.creator_id]?.isAdmin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700 text-purple-200">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {creatorBadges[b.creator_id]?.connectionsCount ?? 0} connections
                    </span>
                    {creatorBadges[b.creator_id]?.relationStatus && creatorBadges[b.creator_id]?.relationStatus !== 'none' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-800 text-blue-200">
                        {relationLabel[creatorBadges[b.creator_id].relationStatus]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4 flex-1">{b.description}</p>
              <button
                onClick={() => handleClickStartChat(b.id)}
                disabled={loading === b.id}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition font-medium shadow-md hover:shadow-lg"
              >
                {loading === b.id ? 'Starting...' : 'Start Chat'}
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleReport('bot', b.id)}
                  disabled={reporting === `bot:${b.id}`}
                  className="px-3 py-2 text-xs rounded-full bg-gray-700 text-gray-100 hover:bg-gray-600 disabled:opacity-60 transition"
                >
                  {reporting === `bot:${b.id}` ? 'Reporting...' : 'Report Bot'}
                </button>
                <button
                  onClick={() => handleReport('user', b.creator_id)}
                  disabled={reporting === `user:${b.creator_id}`}
                  className="px-3 py-2 text-xs rounded-full bg-gray-700 text-gray-100 hover:bg-gray-600 disabled:opacity-60 transition"
                >
                  {reporting === `user:${b.creator_id}` ? 'Reporting...' : 'Report Creator'}
                </button>
              </div>
            </div>
            ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <PersonaPromptModal
        open={personaPromptOpen}
        title="Choose Persona for Bot Chat"
        onCancel={() => {
          setPersonaPromptOpen(false)
          setPendingBotId(null)
        }}
        onConfirm={async (personaId, score, relationshipContext) => {
          if (!pendingBotId) return
          const botId = pendingBotId
          setPersonaPromptOpen(false)
          setPendingBotId(null)
          await handleStartChat(botId, personaId, score, relationshipContext)
        }}
      />
    </div>
  )
}
