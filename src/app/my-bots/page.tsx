"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { BOT_UNIVERSES, UNIVERSE_CATEGORIES } from "@/lib/botUniverses"
import { supabase } from "@/lib/supabase"

type ExampleDialogue = { user: string; bot: string }

type MyBot = {
  id: string
  name: string
  universe: string | null
  description: string
  personality: string
  avatar_url: string | null
  is_published: boolean
  created_at: string
  appearance: string | null
  source_excerpts: string | null
  character_quotes: string[] | null
  default_tone: string | null
  example_dialogues: ExampleDialogue[] | null
}

function normalizePublishedFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "true" || normalized === "1"
  }
  return false
}

type ParsedCharacterProfile = {
  personality: string
  backstory: string
  goals: string
  gender: string
  age: string
  rules: string
  style: string
  appearance: string
}

function getTtrpgRole(bot: MyBot): "NPC" | "DM" | "PC" | "Encounter" | null {
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

function parseCharacterProfile(value: string): ParsedCharacterProfile {
  const parsed: ParsedCharacterProfile = {
    personality: "",
    backstory: "",
    goals: "",
    gender: "",
    age: "",
    rules: "",
    style: "",
    appearance: "",
  }

  type Section = keyof ParsedCharacterProfile
  const mdHeadingMap: Record<string, Section> = {
    appearance: "appearance",
    backstory: "backstory",
    goals: "goals",
    "rules / boundaries": "rules",
    "speaking style": "style",
  }

  const lines = value.split("\n").map((line) => line.trim())
  let currentMdSection: Section | null = null
  const mdSectionLines: Partial<Record<Section, string[]>> = {}

  for (const line of lines) {
    if (!line) {
      currentMdSection = null
      continue
    }

    // Handle markdown headings: ### **Heading**
    const headingMatch = line.match(/^###\s+\*\*(.+?)\*\*\s*$/)
    if (headingMatch) {
      const headingText = headingMatch[1].toLowerCase()
      currentMdSection = mdHeadingMap[headingText] ?? null
      continue
    }

    if (currentMdSection) {
      if (!mdSectionLines[currentMdSection]) mdSectionLines[currentMdSection] = []
      mdSectionLines[currentMdSection]!.push(line)
      continue
    }

    if (!line.includes(":")) continue
    const colonIdx = line.indexOf(":")
    const key = line.slice(0, colonIdx).trim().toLowerCase()
    const content = line.slice(colonIdx + 1).trim()
    if (!content) continue

    if (key === "core personality") parsed.personality = content
    else if (key === "backstory") parsed.backstory = content
    else if (key === "goals & motivations" || key === "goals") parsed.goals = content
    else if (key === "gender") parsed.gender = content
    else if (key === "age") parsed.age = content
    else if (key === "rules / boundaries") parsed.rules = content
    else if (key === "speaking style") parsed.style = content
    else if (key === "appearance") parsed.appearance = content
  }

  // Apply multi-line markdown section content (only if key:value didn't already populate it)
  for (const [section, sectionLines] of Object.entries(mdSectionLines)) {
    const key = section as Section
    if (sectionLines && sectionLines.length > 0 && !parsed[key]) {
      (parsed[key] as string) = sectionLines.join("\n")
    }
  }

  if (!parsed.personality) parsed.personality = value.trim()

  return parsed
}

export default function MyBotsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [uploadingEditAvatarId, setUploadingEditAvatarId] = useState<string | null>(null)
  const [bots, setBots] = useState<MyBot[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [nameSearch, setNameSearch] = useState("")
  const [universeFilter, setUniverseFilter] = useState("")
  const [editingBotId, setEditingBotId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editUniverse, setEditUniverse] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPersonality, setEditPersonality] = useState("")
  const [editBackstory, setEditBackstory] = useState("")
  const [editGoals, setEditGoals] = useState("")
  const [editGender, setEditGender] = useState("")
  const [editAge, setEditAge] = useState("")
  const [editRules, setEditRules] = useState("")
  const [editStyle, setEditStyle] = useState("")
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null)
  const [editAppearance, setEditAppearance] = useState("")
  const [editDefaultTone, setEditDefaultTone] = useState("")
  const [editSourceExcerpts, setEditSourceExcerpts] = useState("")
  const [editCharacterQuotes, setEditCharacterQuotes] = useState("")
  const [editExampleDialogues, setEditExampleDialogues] = useState<ExampleDialogue[]>([{ user: "", bot: "" }])

  const loadBots = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUserId(user.id)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error("Not authenticated")
        router.push('/login')
        return
      }

      const params = new URLSearchParams()
      if (nameSearch.trim()) {
        params.set('name', nameSearch.trim())
      }
      if (universeFilter.trim()) {
        params.set('universe', universeFilter.trim())
      }
      params.set('scope', 'mine')

      const response = await fetch(`/api/bots?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const payload = (await response.json()) as { bots?: MyBot[]; error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load bots')
      }

      const normalizedBots = (payload.bots || []).map((bot) => ({
        ...bot,
        is_published: normalizePublishedFlag(bot.is_published),
      }))

      setBots(normalizedBots)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load bots"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [router, nameSearch, universeFilter])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  const filteredBots = useMemo(() => {
    const normalizedNameSearch = nameSearch.trim().toLowerCase()
    return bots.filter((bot) => {
      const matchesName =
        normalizedNameSearch.length === 0 || bot.name.toLowerCase().includes(normalizedNameSearch)
      const matchesUniverse = universeFilter.length === 0 || bot.universe === universeFilter
      return matchesName && matchesUniverse
    })
  }, [bots, nameSearch, universeFilter])

  async function publishDraft(botId: string) {
    if (!userId) {
      toast.error("Not authenticated")
      router.push("/login")
      return
    }

    setPublishingId(botId)
    try {
      const { error } = await supabase
        .from("bots")
        .update({ is_published: true })
        .eq("id", botId)
        .eq("creator_id", userId)

      if (error) throw error

      setBots((current) =>
        current.map((bot) => (bot.id === botId ? { ...bot, is_published: true } : bot))
      )
      toast.success("Bot published")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish bot"
      toast.error(message)
    } finally {
      setPublishingId(null)
    }
  }

  async function deleteBot(botId: string) {
    if (!userId) {
      toast.error("Not authenticated")
      router.push("/login")
      return
    }

    const confirmed = window.confirm(
      "Delete this private bot/draft? This will permanently remove it and related chats."
    )

    if (!confirmed) {
      return
    }

    setDeletingId(botId)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error("Not authenticated")
        router.push('/login')
        return
      }

      const response = await fetch(`/api/bots/${botId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete bot")
      }

      setBots((current) => current.filter((bot) => bot.id !== botId))

      if (editingBotId === botId) {
        cancelEdit()
      }

      toast.success("Bot deleted")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete bot"
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(bot: MyBot) {
    const parsedProfile = parseCharacterProfile(bot.personality)
    setEditingBotId(bot.id)
    setEditName(bot.name)
    setEditUniverse(bot.universe ?? "")
    setEditDescription(bot.description)
    setEditPersonality(parsedProfile.personality)
    setEditAppearance(bot.appearance ?? parsedProfile.appearance)
    setEditBackstory(parsedProfile.backstory)
    setEditGoals(parsedProfile.goals)
    setEditGender(parsedProfile.gender)
    setEditAge(parsedProfile.age)
    setEditRules(parsedProfile.rules)
    setEditStyle(parsedProfile.style)
    setEditAvatarUrl(bot.avatar_url)
    setEditDefaultTone(bot.default_tone ?? "")
    setEditSourceExcerpts(bot.source_excerpts ?? "")
    setEditCharacterQuotes(bot.character_quotes?.join("\n") ?? "")
    setEditExampleDialogues(
      bot.example_dialogues && bot.example_dialogues.length > 0
        ? bot.example_dialogues
        : [{ user: "", bot: "" }]
    )
  }

  function cancelEdit() {
    setEditingBotId(null)
    setEditName("")
    setEditUniverse("")
    setEditDescription("")
    setEditPersonality("")
    setEditAppearance("")
    setEditBackstory("")
    setEditGoals("")
    setEditGender("")
    setEditAge("")
    setEditRules("")
    setEditStyle("")
    setEditAvatarUrl(null)
    setEditDefaultTone("")
    setEditSourceExcerpts("")
    setEditCharacterQuotes("")
    setEditExampleDialogues([{ user: "", bot: "" }])
  }

  async function handleEditAvatarUpload(e: ChangeEvent<HTMLInputElement>, botId: string) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    try {
      setUploadingEditAvatarId(botId)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error("Not authenticated")
        router.push("/login")
        return
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "avatars")

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Avatar upload failed")
      }

      setEditAvatarUrl(payload.url)
      toast.success("Avatar updated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Avatar upload failed"
      toast.error(message)
    } finally {
      setUploadingEditAvatarId(null)
    }
  }

  async function saveEdit(botId: string) {
    if (!editName.trim() || !editUniverse.trim() || !editDescription.trim() || !editPersonality.trim()) {
      toast.error("Please complete all bot edit fields")
      return
    }

    if (editAge.trim() && parseInt(editAge.trim(), 10) < 18) {
      toast.error("Character age must be 18 or older")
      return
    }

    try {
      setSavingEditId(botId)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error("Not authenticated")
        router.push("/login")
        return
      }

      const response = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          universe: editUniverse.trim(),
          description: editDescription.trim(),
          personality: editPersonality.trim(),
          appearance: editAppearance.trim() || null,
          backstory: editBackstory.trim(),
          goals: editGoals.trim(),
          gender: editGender.trim(),
          age: editAge.trim(),
          rules: editRules.trim(),
          style: editStyle.trim(),
          avatarUrl: editAvatarUrl,
          defaultTone: editDefaultTone.trim() || null,
          sourceExcerpts: editSourceExcerpts.trim() || null,
          characterQuotes: editCharacterQuotes
            .split("\n")
            .map((q) => q.trim())
            .filter(Boolean)
            .slice(0, 10),
          exampleDialogues: editExampleDialogues.filter((d) => d.user.trim() && d.bot.trim()),
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        bot?: {
          id: string
          name: string
          universe: string | null
          description: string
          personality: string
          avatar_url: string | null
        }
      }

      if (!response.ok || !payload.bot) {
        throw new Error(payload.error || "Failed to update bot")
      }

      setBots((current) =>
        current.map((bot) =>
          bot.id === botId
            ? {
                ...bot,
                name: payload.bot?.name ?? bot.name,
                universe: payload.bot?.universe ?? bot.universe,
                description: payload.bot?.description ?? bot.description,
                personality: payload.bot?.personality ?? bot.personality,
                avatar_url: payload.bot?.avatar_url ?? bot.avatar_url,
              }
            : bot
        )
      )

      toast.success("Bot updated")
      cancelEdit()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update bot"
      toast.error(message)
    } finally {
      setSavingEditId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-bold text-white">My Bots</h1>
          <button
            onClick={() => router.push("/create")}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-full font-semibold transition"
          >
            Create New Bot
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Search bot name"
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          />
          <select
            value={universeFilter}
            onChange={(e) => setUniverseFilter(e.target.value)}
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
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

        {loading ? (
          <div className="text-gray-400">Loading bots...</div>
        ) : bots.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-gray-300">
            No bots found.
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-gray-300">
            No bots match this name/universe search.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBots.map((bot) => {
              const isPublished = normalizePublishedFlag(bot.is_published)

              return (
              <div key={bot.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  {bot.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bot.avatar_url} alt={bot.name} className="w-14 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-700" />
                  )}

                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-semibold truncate">{bot.name}</h2>
                    {bot.universe && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-purple-300">{bot.universe}</p>
                        {getTtrpgRole(bot) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-700 bg-purple-900/40 text-purple-200">
                            TTRPG • {getTtrpgRole(bot)}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs mt-1">
                      {isPublished ? (
                        <span className="text-green-300">Published</span>
                      ) : (
                        <span className="text-yellow-300">Draft</span>
                      )}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">{bot.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Created {new Date(bot.created_at).toLocaleString()}
                    </p>
                  </div>

                  {!isPublished && (
                    <>
                      <button
                        onClick={() => publishDraft(bot.id)}
                        disabled={publishingId === bot.id || deletingId === bot.id}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-full text-sm font-semibold transition"
                      >
                        {publishingId === bot.id ? "Publishing..." : "Publish"}
                      </button>
                      <button
                        onClick={() => deleteBot(bot.id)}
                        disabled={deletingId === bot.id || publishingId === bot.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-full text-sm font-semibold transition"
                      >
                        {deletingId === bot.id ? "Deleting..." : "Delete"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => startEdit(bot)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm font-semibold transition"
                  >
                    Edit
                  </button>
                </div>

                {editingBotId === bot.id && (
                  <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Bot name"
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    />

                    <select
                      value={editUniverse}
                      onChange={(e) => setEditUniverse(e.target.value)}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="" disabled>
                        Select a universe
                      </option>
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

                    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3">
                      <label className="block text-sm font-medium text-gray-300 mb-3">Bot avatar</label>
                      <div className="flex flex-wrap items-center gap-3">
                        {editAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={editAvatarUrl}
                            alt={`${editName || bot.name} avatar`}
                            className="w-14 h-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-700" />
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleEditAvatarUpload(e, bot.id)}
                            disabled={uploadingEditAvatarId === bot.id}
                            className="text-sm text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                          />
                          {editAvatarUrl && (
                            <button
                              type="button"
                              onClick={() => setEditAvatarUrl(null)}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-xs font-semibold transition"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Bot description"
                      rows={3}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />

                    <textarea
                      value={editPersonality}
                      onChange={(e) => setEditPersonality(e.target.value)}
                      placeholder="Core personality"
                      rows={4}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />

                    <textarea
                      value={editAppearance}
                      onChange={(e) => setEditAppearance(e.target.value)}
                      placeholder="Appearance (physical features, clothing, distinguishing marks...)"
                      rows={3}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />

                    <textarea
                      value={editBackstory}
                      onChange={(e) => setEditBackstory(e.target.value)}
                      placeholder="Backstory"
                      rows={3}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <textarea
                        value={editGoals}
                        onChange={(e) => setEditGoals(e.target.value)}
                        placeholder="Goals / motivations"
                        rows={3}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Gender</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        >
                          <option value="">Select gender...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Non-binary">Non-binary</option>
                          <option value="Genderfluid">Genderfluid</option>
                          <option value="Agender">Agender</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">Age (18+)</label>
                        <input
                          type="number"
                          min={18}
                          value={editAge}
                          onChange={(e) => setEditAge(e.target.value)}
                          placeholder="Must be 18 or older"
                          className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>

                    <textarea
                      value={editRules}
                      onChange={(e) => setEditRules(e.target.value)}
                      placeholder="Rules / boundaries"
                      rows={3}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <textarea
                        value={editStyle}
                        onChange={(e) => setEditStyle(e.target.value)}
                        placeholder="Speaking style"
                        rows={3}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Default Tone</label>
                      <input
                        type="text"
                        maxLength={200}
                        value={editDefaultTone}
                        onChange={(e) => setEditDefaultTone(e.target.value)}
                        placeholder="e.g. Romantic, Dark, Playful, Mysterious"
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>

                    <div className="border-t border-gray-700 pt-3">
                      <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wide mb-1">Source Material</h3>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Iconic Quotes</label>
                      <textarea
                        value={editCharacterQuotes}
                        onChange={(e) => setEditCharacterQuotes(e.target.value)}
                        placeholder={"One quote per line:\n\"I am inevitable.\""}
                        rows={4}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Up to 10 quotes, one per line.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Script / Book Excerpts</label>
                      <textarea
                        value={editSourceExcerpts}
                        onChange={(e) => setEditSourceExcerpts(e.target.value)}
                        placeholder="Paste representative scenes or dialogue from source material..."
                        rows={5}
                        maxLength={6000}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">{editSourceExcerpts.length}/6000 characters.</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-gray-400">Example Conversations</label>
                        <button
                          type="button"
                          onClick={() => setEditExampleDialogues((prev) => [...prev, { user: "", bot: "" }])}
                          disabled={editExampleDialogues.length >= 8}
                          className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          + Add example
                        </button>
                      </div>
                      <div className="space-y-3">
                        {editExampleDialogues.map((pair, idx) => (
                          <div key={idx} className="bg-gray-900 border border-gray-700 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-semibold">Example {idx + 1}</span>
                              {editExampleDialogues.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setEditExampleDialogues((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">User says:</label>
                              <input
                                type="text"
                                value={pair.user}
                                onChange={(e) =>
                                  setEditExampleDialogues((prev) =>
                                    prev.map((p, i) => (i === idx ? { ...p, user: e.target.value } : p))
                                  )
                                }
                                placeholder="What the user might say..."
                                className="w-full p-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">{editName.trim() || bot.name} responds:</label>
                              <textarea
                                value={pair.bot}
                                onChange={(e) =>
                                  setEditExampleDialogues((prev) =>
                                    prev.map((p, i) => (i === idx ? { ...p, bot: e.target.value } : p))
                                  )
                                }
                                placeholder="How the character would actually respond..."
                                rows={2}
                                className="w-full p-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full text-sm font-semibold transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(bot.id)}
                        disabled={savingEditId === bot.id || uploadingEditAvatarId === bot.id}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-full text-sm font-semibold transition"
                      >
                        {savingEditId === bot.id ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
