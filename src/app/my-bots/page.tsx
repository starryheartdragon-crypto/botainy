"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { BOT_UNIVERSES } from "@/lib/botUniverses"
import { supabase } from "@/lib/supabase"

type MyBot = {
  id: string
  name: string
  universe: string | null
  description: string
  personality: string
  avatar_url: string | null
  is_published: boolean
  created_at: string
}

type ParsedCharacterProfile = {
  personality: string
  backstory: string
  goals: string
  scenario: string
  rules: string
  style: string
  greeting: string
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
    personality: value.trim(),
    backstory: "",
    goals: "",
    scenario: "",
    rules: "",
    style: "",
    greeting: "",
  }

  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (!line.includes(":")) continue
    const [rawKey, ...rest] = line.split(":")
    const key = rawKey.trim().toLowerCase()
    const content = rest.join(":").trim()
    if (!content) continue

    if (key === "core personality") parsed.personality = content
    else if (key === "backstory") parsed.backstory = content
    else if (key === "goals & motivations") parsed.goals = content
    else if (key === "preferred scenario") parsed.scenario = content
    else if (key === "rules / boundaries") parsed.rules = content
    else if (key === "speaking style") parsed.style = content
    else if (key === "suggested greeting") parsed.greeting = content
  }

  return parsed
}

export default function MyBotsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState<string | null>(null)
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
  const [editScenario, setEditScenario] = useState("")
  const [editRules, setEditRules] = useState("")
  const [editStyle, setEditStyle] = useState("")
  const [editGreeting, setEditGreeting] = useState("")
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null)

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

      setBots(payload.bots || [])
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

  function startEdit(bot: MyBot) {
    const parsedProfile = parseCharacterProfile(bot.personality)
    setEditingBotId(bot.id)
    setEditName(bot.name)
    setEditUniverse(bot.universe ?? "")
    setEditDescription(bot.description)
    setEditPersonality(parsedProfile.personality)
    setEditBackstory(parsedProfile.backstory)
    setEditGoals(parsedProfile.goals)
    setEditScenario(parsedProfile.scenario)
    setEditRules(parsedProfile.rules)
    setEditStyle(parsedProfile.style)
    setEditGreeting(parsedProfile.greeting)
    setEditAvatarUrl(bot.avatar_url)
  }

  function cancelEdit() {
    setEditingBotId(null)
    setEditName("")
    setEditUniverse("")
    setEditDescription("")
    setEditPersonality("")
    setEditBackstory("")
    setEditGoals("")
    setEditScenario("")
    setEditRules("")
    setEditStyle("")
    setEditGreeting("")
    setEditAvatarUrl(null)
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
          backstory: editBackstory.trim(),
          goals: editGoals.trim(),
          scenario: editScenario.trim(),
          rules: editRules.trim(),
          style: editStyle.trim(),
          greeting: editGreeting.trim(),
          avatarUrl: editAvatarUrl,
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
            {BOT_UNIVERSES.map((universe) => (
              <option key={universe} value={universe}>
                {universe}
              </option>
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
            {filteredBots.map((bot) => (
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
                      {bot.is_published ? (
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

                  {!bot.is_published && (
                    <button
                      onClick={() => publishDraft(bot.id)}
                      disabled={publishingId === bot.id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-full text-sm font-semibold transition"
                    >
                      {publishingId === bot.id ? "Publishing..." : "Publish"}
                    </button>
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
                      {BOT_UNIVERSES.map((universe) => (
                        <option key={universe} value={universe}>
                          {universe}
                        </option>
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

                    <textarea
                      value={editScenario}
                      onChange={(e) => setEditScenario(e.target.value)}
                      placeholder="Roleplay scenario"
                      rows={3}
                      className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                    />

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

                      <textarea
                        value={editGreeting}
                        onChange={(e) => setEditGreeting(e.target.value)}
                        placeholder="First message hint"
                        rows={3}
                        className="w-full p-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                      />
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
