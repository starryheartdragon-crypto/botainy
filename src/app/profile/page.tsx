"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { supabase } from "@/lib/supabase"
import { HARD_BOUNDARY_OPTIONS } from "@/lib/roleplayFormatting"

type ProfilePersona = {
  id: string
  name: string
  description: string
  avatar_url: string | null
  created_at: string
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [musicLoading, setMusicLoading] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [playlistInput, setPlaylistInput] = useState("")
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Array<{ id: string; title: string; url: string; created_at: string }>>([])
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [originalUsername, setOriginalUsername] = useState("")
  const [originalBio, setOriginalBio] = useState("")
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(null)
  const [connectionsCount, setConnectionsCount] = useState<number>(0)
  const [personas, setPersonas] = useState<ProfilePersona[]>([])
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
  const [editingPersonaName, setEditingPersonaName] = useState("")
  const [editingPersonaDescription, setEditingPersonaDescription] = useState("")
  const [personaSavingId, setPersonaSavingId] = useState<string | null>(null)
  const [personaDeletingId, setPersonaDeletingId] = useState<string | null>(null)
  const [hardBoundaries, setHardBoundaries] = useState<string[]>([])
  const [originalHardBoundaries, setOriginalHardBoundaries] = useState<string[]>([])
  const [pronouns, setPronouns] = useState("")
  const [originalPronouns, setOriginalPronouns] = useState("")
  const [location, setLocation] = useState("")
  const [originalLocation, setOriginalLocation] = useState("")
  const [accentColor, setAccentColor] = useState("#a855f7")
  const [originalAccentColor, setOriginalAccentColor] = useState("#a855f7")
  const [interestTags, setInterestTags] = useState<string[]>([])
  const [originalInterestTags, setOriginalInterestTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [privacy, setPrivacy] = useState({
    show_bio: true,
    show_avatar: true,
    show_bots: true,
    show_music: true,
    show_connections_count: true,
    show_join_date: true,
    show_pronouns: true,
    show_location: true,
    show_tags: true,
  })
  const [sectionOrder, setSectionOrder] = useState(["bio", "tags", "music", "bots", "personas", "guestbook"])
  const [savingSectionOrder, setSavingSectionOrder] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        // Use onAuthStateChange to ensure session is loaded
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) {
          console.log('No session or token available')
          setLoading(false)
          return
        }

        console.log('Loading profile with token')
        const resp = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })
        
        console.log('Profile response:', resp.status)
        
        if (resp.ok) {
          const data = await resp.json()
          console.log('Profile data loaded:', data)
          const loadedUsername = data.username ?? ""
          const loadedBio = data.bio ?? ""
          const loadedAvatar = data.avatar_url ?? null
          const loadedBoundaries: string[] = Array.isArray(data.hard_boundaries) ? data.hard_boundaries : []
          const loadedPronouns = data.pronouns ?? ""
          const loadedLocation = data.location ?? ""
          const loadedAccentColor = data.accent_color ?? "#a855f7"
          const loadedTags: string[] = Array.isArray(data.interest_tags) ? data.interest_tags : []

          setUsername(loadedUsername)
          setBio(loadedBio)
          setAvatarUrl(loadedAvatar)
          setOriginalUsername(loadedUsername)
          setOriginalBio(loadedBio)
          setOriginalAvatarUrl(loadedAvatar)
          setHardBoundaries(loadedBoundaries)
          setOriginalHardBoundaries(loadedBoundaries)
          setPronouns(loadedPronouns)
          setOriginalPronouns(loadedPronouns)
          setLocation(loadedLocation)
          setOriginalLocation(loadedLocation)
          setAccentColor(loadedAccentColor)
          setOriginalAccentColor(loadedAccentColor)
          setInterestTags(loadedTags)
          setOriginalInterestTags(loadedTags)

          const badgeResp = await fetch(`/api/users/badges?ids=${data.id}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          })
          if (badgeResp.ok) {
            const badgeData = await badgeResp.json()
            const me = Array.isArray(badgeData) ? badgeData[0] : null
            setConnectionsCount(me?.connectionsCount ?? 0)
          }

          const musicResp = await fetch('/api/profile/music', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          })

          if (musicResp.ok) {
            const musicData = await musicResp.json()
            setPlaylistUrl(musicData.playlistUrl || null)
            setPlaylistInput(musicData.playlistUrl || "")
            setTracks(musicData.tracks || [])
          }

          const personasResp = await fetch('/api/personas', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          })

          if (personasResp.ok) {
            const personasData = await personasResp.json()
            setPersonas(Array.isArray(personasData.personas) ? personasData.personas : [])
          } else {
            setPersonas([])
          }

          const privacyResp = await fetch('/api/profile/privacy', {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          })
          if (privacyResp.ok) {
            const privacyData = await privacyResp.json()
            setPrivacy({
              show_bio: privacyData.show_bio ?? true,
              show_avatar: privacyData.show_avatar ?? true,
              show_bots: privacyData.show_bots ?? true,
              show_music: privacyData.show_music ?? true,
              show_connections_count: privacyData.show_connections_count ?? true,
              show_join_date: privacyData.show_join_date ?? true,
              show_pronouns: privacyData.show_pronouns ?? true,
              show_location: privacyData.show_location ?? true,
              show_tags: privacyData.show_tags ?? true,
            })
            setSectionOrder(privacyData.section_order ?? ["bio", "tags", "music", "bots", "personas", "guestbook"])
          }
        } else {
          const error = await resp.json()
          console.error('Profile load error:', error)
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }

    // Wait a bit for session to initialize
    const timer = setTimeout(() => {
      loadProfile()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!isEditing) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      console.log('Saving profile with token:', session.access_token.slice(0, 10) + '...')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const resp = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username, bio, avatar_url: avatarUrl, hard_boundaries: hardBoundaries, pronouns, location, accent_color: accentColor, interest_tags: interestTags }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await resp.json()
      console.log('Save response:', resp.status, data)

      if (!resp.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`)
      }

      toast.success("Profile saved")
      setOriginalUsername(username)
      setOriginalBio(bio)
      setOriginalAvatarUrl(avatarUrl)
      setOriginalHardBoundaries(hardBoundaries)
      setOriginalPronouns(pronouns)
      setOriginalLocation(location)
      setOriginalAccentColor(accentColor)
      setOriginalInterestTags(interestTags)
      setIsEditing(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save"
      console.error('Save error:', err)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function extractPlaylistId(url: string | null) {
    if (!url) return null
    try {
      const parsed = new URL(url)
      return parsed.searchParams.get('list')
    } catch {
      return null
    }
  }

  async function uploadSingleTrack(file: File, token: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''))

    const resp = await fetch('/api/profile/music/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    const data = await resp.json()
    if (!resp.ok) {
      throw new Error(data.error || 'Upload failed')
    }

    return data
  }

  async function uploadMusicFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    if (playlistUrl) {
      toast.error('Clear playlist before uploading tracks')
      return
    }

    const availableSlots = Math.max(0, 12 - tracks.length)
    if (availableSlots === 0) {
      toast.error('You already have 12 tracks')
      return
    }

    const filesToUpload = files.slice(0, availableSlots)
    if (files.length > availableSlots) {
      toast.error(`Only ${availableSlots} more track(s) can be uploaded`)
    }

    try {
      setMusicLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const uploadedTracks: Array<{ id: string; title: string; url: string; created_at: string }> = []
      let failed = 0

      for (const file of filesToUpload) {
        try {
          const uploaded = await uploadSingleTrack(file, session.access_token)
          uploadedTracks.push(uploaded)
        } catch {
          failed += 1
        }
      }

      if (uploadedTracks.length > 0) {
        setTracks((prev) => [...prev, ...uploadedTracks])
        toast.success(`${uploadedTracks.length} track(s) uploaded`)
      }

      if (failed > 0) {
        toast.error(`${failed} track(s) failed to upload`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      toast.error(message)
    } finally {
      setMusicLoading(false)
    }
  }

  async function uploadMusicTrack(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    await uploadMusicFiles(files)
    e.target.value = ''
  }

  function handleMusicDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (!isEditing || musicLoading || !!playlistUrl || tracks.length >= 12) return

    const droppedFiles = e.dataTransfer.files
    if (!droppedFiles || droppedFiles.length === 0) return
    void uploadMusicFiles(droppedFiles)
  }

  function handleMusicDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (isEditing && !musicLoading && !playlistUrl && tracks.length < 12) {
      setIsDragActive(true)
    }
  }

  function handleMusicDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  async function handlePrivacyToggle(key: keyof typeof privacy) {
    const updated = { ...privacy, [key]: !privacy[key] }
    setPrivacy(updated)
    setSavingPrivacy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const resp = await fetch('/api/profile/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ [key]: !privacy[key] }),
      })
      if (!resp.ok) {
        setPrivacy(privacy) // revert
        toast.error('Failed to save privacy setting')
      }
    } catch {
      setPrivacy(privacy) // revert
      toast.error('Failed to save privacy setting')
    } finally {
      setSavingPrivacy(false)
    }
  }

  async function moveSectionUp(idx: number) {
    if (idx === 0) return
    const updated = [...sectionOrder]
    ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
    await saveSectionOrder(updated)
  }

  async function moveSectionDown(idx: number) {
    if (idx === sectionOrder.length - 1) return
    const updated = [...sectionOrder]
    ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    await saveSectionOrder(updated)
  }

  async function saveSectionOrder(order: string[]) {
    setSectionOrder(order)
    setSavingSectionOrder(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const resp = await fetch('/api/profile/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ section_order: order }),
      })
      if (!resp.ok) toast.error('Failed to save section order')
    } catch {
      toast.error('Failed to save section order')
    } finally {
      setSavingSectionOrder(false)
    }
  }

  async function savePlaylist() {
    try {
      setMusicLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const resp = await fetch('/api/profile/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ playlistUrl: playlistInput }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to save playlist')
      }

      setPlaylistUrl(data.playlistUrl)
      toast.success('Playlist saved')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save playlist'
      toast.error(message)
    } finally {
      setMusicLoading(false)
    }
  }

  async function clearPlaylist() {
    try {
      setMusicLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const resp = await fetch('/api/profile/music', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clearPlaylist: true }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to clear playlist')
      }

      setPlaylistUrl(null)
      setPlaylistInput('')
      toast.success('Playlist removed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear playlist'
      toast.error(message)
    } finally {
      setMusicLoading(false)
    }
  }

  async function removeTrack(trackId: string) {
    try {
      setMusicLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const resp = await fetch('/api/profile/music', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ trackId }),
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to remove track')
      }

      setTracks((prev) => prev.filter((t) => t.id !== trackId))
      toast.success('Track removed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove track'
      toast.error(message)
    } finally {
      setMusicLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isEditing || loading) return
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      console.log('Uploading file:', file.name)

      const formData = new FormData()
      formData.append('file', file)

      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!resp.ok) {
        const error = await resp.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await resp.json()
      console.log('Upload successful:', data.url)
      setAvatarUrl(data.url)
      toast.success('Avatar uploaded')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      toast.error(message)
      console.error('Upload error:', err)
    }
  }

  function handleStartEdit() {
    if (loading) return
    setIsEditing(true)
  }

  function handleCancelEdit() {
    if (loading) return
    setUsername(originalUsername)
    setBio(originalBio)
    setAvatarUrl(originalAvatarUrl)
    setHardBoundaries(originalHardBoundaries)
    setPronouns(originalPronouns)
    setLocation(originalLocation)
    setAccentColor(originalAccentColor)
    setInterestTags(originalInterestTags)
    setIsEditing(false)
  }

  function startPersonaEdit(persona: ProfilePersona) {
    setEditingPersonaId(persona.id)
    setEditingPersonaName(persona.name)
    setEditingPersonaDescription(persona.description)
  }

  function cancelPersonaEdit() {
    setEditingPersonaId(null)
    setEditingPersonaName("")
    setEditingPersonaDescription("")
  }

  async function savePersonaEdit(personaId: string) {
    if (!editingPersonaName.trim() || !editingPersonaDescription.trim()) {
      toast.error("Persona name and description are required")
      return
    }

    try {
      setPersonaSavingId(personaId)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Not authenticated")
      }

      const resp = await fetch(`/api/personas/${personaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: editingPersonaName,
          description: editingPersonaDescription,
        }),
      })

      const data = await resp.json()
      if (!resp.ok || !data.persona) {
        throw new Error(data.error || "Failed to update persona")
      }

      setPersonas((prev) => prev.map((persona) => (persona.id === personaId ? data.persona : persona)))
      toast.success("Persona updated")
      cancelPersonaEdit()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update persona"
      toast.error(message)
    } finally {
      setPersonaSavingId(null)
    }
  }

  async function deletePersona(personaId: string) {
    const confirmed = window.confirm("Delete this persona? This cannot be undone.")
    if (!confirmed) return

    try {
      setPersonaDeletingId(personaId)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Not authenticated")
      }

      const resp = await fetch(`/api/personas/${personaId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || "Failed to delete persona")
      }

      setPersonas((prev) => prev.filter((persona) => persona.id !== personaId))
      if (editingPersonaId === personaId) {
        cancelPersonaEdit()
      }
      toast.success("Persona deleted")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete persona"
      toast.error(message)
    } finally {
      setPersonaDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-4">Profile</h1>
        <a
          href="/connections"
          className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/30 border border-blue-800 text-blue-200 text-sm hover:bg-blue-900/50 transition"
        >
          <span className="font-semibold">Connections:</span>
          <span>{connectionsCount}</span>
        </a>

        <form onSubmit={handleSave} className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          {isEditing ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Editing profile</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={loading}
                  className="px-5 py-2 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition font-medium disabled:opacity-50 shadow-lg"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              {username && (
                <a
                  href={`/profile/${username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-gray-700 text-gray-200 rounded-full hover:bg-gray-600 transition font-medium flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Preview Public Profile
                </a>
              )}
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={loading}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition font-medium disabled:opacity-50"
              >
                Edit Profile
              </button>
            </div>
          )}

          {isEditing ? (
            <>
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-gray-300">U</div>
                )}
                <div>
                  <label className="block text-sm text-gray-300">Upload avatar</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    disabled={loading}
                    className="mt-2 text-sm text-gray-300 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full mt-1 p-2 bg-gray-900 border border-gray-700 rounded text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={loading}
                  className="w-full mt-1 p-2 bg-gray-900 border border-gray-700 rounded text-white disabled:opacity-60"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300">Pronouns</label>
                  <div className="flex flex-wrap gap-1 mt-1 mb-2">
                    {["she/her", "he/him", "they/them", "she/they", "he/they", "any/all"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPronouns(p)}
                        className={`px-2 py-0.5 rounded-full text-xs border transition ${pronouns === p ? "bg-purple-700 border-purple-500 text-white" : "bg-gray-800 border-gray-600 text-gray-300 hover:border-purple-500"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <input
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    placeholder="or type custom..."
                    maxLength={40}
                    disabled={loading}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300">Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Tokyo, Japan"
                    maxLength={80}
                    disabled={loading}
                    className="w-full mt-1 p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300">Accent Color</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    disabled={loading}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-700 bg-transparent disabled:opacity-60"
                  />
                  <input
                    value={accentColor}
                    onChange={(e) => {
                      const val = e.target.value
                      if (/^#[0-9a-fA-F]{0,6}$/.test(val)) setAccentColor(val)
                    }}
                    maxLength={7}
                    disabled={loading}
                    className="w-28 p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm font-mono disabled:opacity-60"
                  />
                  <span
                    className="text-xs px-3 py-1.5 rounded-full font-semibold"
                    style={{ backgroundColor: accentColor, color: '#fff' }}
                  >
                    Preview
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300">
                  Interest Tags <span className="text-gray-500 text-xs">({interestTags.length}/20)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {interestTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-600 bg-gray-800 text-gray-200"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setInterestTags((prev) => prev.filter((t) => t !== tag))}
                        className="text-gray-500 hover:text-red-400 transition ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault()
                        const trimmed = tagInput.trim().replace(/,+$/, '')
                        if (trimmed && trimmed.length <= 30 && !interestTags.includes(trimmed) && interestTags.length < 20) {
                          setInterestTags((prev) => [...prev, trimmed])
                          setTagInput("")
                        }
                      }
                    }}
                    placeholder="Type tag + Enter"
                    maxLength={30}
                    disabled={loading || interestTags.length >= 20}
                    className="flex-1 p-2 bg-gray-900 border border-gray-700 rounded text-white text-sm disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = tagInput.trim()
                      if (trimmed && trimmed.length <= 30 && !interestTags.includes(trimmed) && interestTags.length < 20) {
                        setInterestTags((prev) => [...prev, trimmed])
                        setTagInput("")
                      }
                    }}
                    disabled={loading || !tagInput.trim() || interestTags.length >= 20}
                    className="px-3 py-2 bg-purple-700 text-white rounded hover:bg-purple-600 disabled:opacity-50 text-sm"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Press Enter or comma to add. Max 20 tags, 30 chars each.</p>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xl font-semibold">
                    U
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-white truncate">{username || "Set a username"}</p>
                  {pronouns && <p className="text-sm text-gray-400">{pronouns}</p>}
                  {location && <p className="text-xs text-gray-500">📍 {location}</p>}
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                  {bio.trim() ? bio : "No bio yet."}
                </p>
              </div>

              {interestTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {interestTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-600 bg-gray-800 text-gray-300"
                      style={{ borderColor: accentColor }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">Accent color:</span>
                <span className="w-5 h-5 rounded-full border border-gray-600" style={{ backgroundColor: accentColor }} />
                <span className="text-xs text-gray-500 font-mono">{accentColor}</span>
              </div>
            </div>
          )}
        </form>

        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Personas</h2>
            <a
              href="/create"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition text-sm font-medium"
            >
              Create Persona
            </a>
          </div>

          {personas.length === 0 ? (
            <p className="text-sm text-gray-400">No personas yet. Create one to use in chats.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {personas.map((persona) => (
                <div key={persona.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {persona.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={persona.avatar_url}
                        alt={persona.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                        P
                      </div>
                    )}
                    {editingPersonaId === persona.id ? (
                      <input
                        value={editingPersonaName}
                        onChange={(e) => setEditingPersonaName(e.target.value)}
                        className="flex-1 text-sm font-semibold text-white bg-gray-950 border border-gray-700 rounded px-2 py-1"
                        maxLength={60}
                      />
                    ) : (
                      <p className="text-sm font-semibold text-white truncate">{persona.name}</p>
                    )}
                  </div>

                  {editingPersonaId === persona.id ? (
                    <textarea
                      value={editingPersonaDescription}
                      onChange={(e) => setEditingPersonaDescription(e.target.value)}
                      rows={4}
                      className="w-full text-sm text-gray-300 bg-gray-950 border border-gray-700 rounded px-2 py-2"
                    />
                  ) : (
                    <p className="text-sm text-gray-400 line-clamp-3 whitespace-pre-wrap">
                      {persona.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    {editingPersonaId === persona.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => savePersonaEdit(persona.id)}
                          disabled={personaSavingId === persona.id || personaDeletingId === persona.id}
                          className="px-3 py-1.5 text-xs bg-blue-700 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
                        >
                          {personaSavingId === persona.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelPersonaEdit}
                          disabled={personaSavingId === persona.id || personaDeletingId === persona.id}
                          className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-full hover:bg-gray-600 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPersonaEdit(persona)}
                        disabled={personaDeletingId === persona.id}
                        className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded-full hover:bg-gray-600 disabled:opacity-50"
                      >
                        Edit
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => deletePersona(persona.id)}
                      disabled={personaDeletingId === persona.id || personaSavingId === persona.id}
                      className="px-3 py-1.5 text-xs bg-red-700 text-white rounded-full hover:bg-red-600 disabled:opacity-50"
                    >
                      {personaDeletingId === persona.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-5">
          <h2 className="text-xl font-semibold text-white">Profile Music</h2>
          <p className="text-sm text-gray-400">
            Add up to 12 uploaded tracks or use one YouTube playlist link.
          </p>
          {isEditing ? (
            <>
              <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-3">
                <label className="block text-sm text-gray-300">YouTube Playlist URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={playlistInput}
                    onChange={(e) => setPlaylistInput(e.target.value)}
                    placeholder="https://www.youtube.com/playlist?list=..."
                    disabled={musicLoading || tracks.length > 0}
                    className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded text-white disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={savePlaylist}
                    disabled={musicLoading || tracks.length > 0 || !playlistInput.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full hover:from-red-700 hover:to-red-800 disabled:opacity-50"
                  >
                    Save Playlist
                  </button>
                  <button
                    type="button"
                    onClick={clearPlaylist}
                    disabled={musicLoading || !playlistUrl}
                    className="px-4 py-2 bg-gray-700 text-white rounded-full hover:bg-gray-600 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                {tracks.length > 0 && (
                  <p className="text-xs text-yellow-300">Remove uploaded tracks before setting a playlist.</p>
                )}
              </div>

              <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-300">Uploaded Tracks</label>
                  <span className="text-xs text-gray-400">{tracks.length}/12</span>
                </div>

                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={uploadMusicTrack}
                  disabled={musicLoading || !!playlistUrl || tracks.length >= 12}
                  className="text-sm text-gray-300 disabled:opacity-50"
                />

                <div
                  onDrop={handleMusicDrop}
                  onDragOver={handleMusicDragOver}
                  onDragLeave={handleMusicDragLeave}
                  className={`border rounded-lg p-4 text-sm transition ${
                    isDragActive
                      ? 'border-blue-500 bg-blue-900/20 text-blue-200'
                      : 'border-gray-700 bg-gray-950 text-gray-400'
                  } ${musicLoading || !!playlistUrl || tracks.length >= 12 ? 'opacity-50' : ''}`}
                >
                  Drag and drop audio files here to upload multiple tracks.
                </div>

                {!!playlistUrl && (
                  <p className="text-xs text-yellow-300">Clear playlist before uploading tracks.</p>
                )}

                {tracks.length === 0 ? (
                  <p className="text-sm text-gray-500">No uploaded tracks yet.</p>
                ) : (
                  <div className="space-y-3">
                    {tracks.map((track) => (
                      <div key={track.id} className="bg-gray-950 border border-gray-700 rounded p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-sm font-medium text-white truncate">{track.title}</p>
                          <button
                            type="button"
                            onClick={() => removeTrack(track.id)}
                            disabled={musicLoading}
                            className="px-3 py-1 text-xs bg-red-700 text-white rounded-full hover:bg-red-600 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                        <audio controls className="w-full">
                          <source src={track.url} />
                        </audio>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
              {tracks.length === 0 ? (
                <p className="text-sm text-gray-500">No uploaded tracks yet.</p>
              ) : (
                <div className="space-y-3">
                  {tracks.map((track) => (
                    <div key={track.id} className="bg-gray-950 border border-gray-700 rounded p-3">
                      <p className="text-sm font-medium text-white truncate mb-2">{track.title}</p>
                      <audio controls className="w-full">
                        <source src={track.url} />
                      </audio>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {playlistUrl && extractPlaylistId(playlistUrl) && (
            <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-3">
              <p className="text-sm text-gray-300">Active Playlist Preview</p>
              <iframe
                title="YouTube Playlist"
                className="w-full aspect-video rounded border border-gray-700"
                src={`https://www.youtube.com/embed/videoseries?list=${extractPlaylistId(playlistUrl)}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Hard Boundaries</h2>
            <p className="mt-1 text-sm text-gray-400">
              Select any content categories you want permanently blocked. When active, the AI will redirect
              those scenarios toward combat or verbal confrontation instead — regardless of bot personality
              or NSFW settings.
            </p>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              {HARD_BOUNDARY_OPTIONS.map((option) => {
                const checked = hardBoundaries.includes(option.key)
                return (
                  <label
                    key={option.key}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={loading}
                      onChange={() => {
                        setHardBoundaries((prev) =>
                          checked ? prev.filter((k) => k !== option.key) : [...prev, option.key]
                        )
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-900 accent-purple-500 disabled:opacity-50"
                    />
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-purple-300 transition">
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-400">{option.description}</p>
                    </div>
                  </label>
                )
              })}
              <p className="text-xs text-yellow-400 pt-1">
                Save your profile to apply boundary changes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {hardBoundaries.length === 0 ? (
                <p className="text-sm text-gray-500">No boundaries set. Edit your profile to configure.</p>
              ) : (
                <ul className="space-y-1">
                  {HARD_BOUNDARY_OPTIONS.filter((o) => hardBoundaries.includes(o.key)).map((o) => (
                    <li key={o.key} className="flex items-center gap-2 text-sm text-white">
                      <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      {o.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Public Profile Privacy Settings */}
        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Public Profile Privacy</h2>
            <p className="mt-1 text-sm text-gray-400">
              Control what visitors can see on your public profile at{" "}
              <span className="text-purple-400">/profile/{username || "you"}</span>.
              Changes save instantly.
            </p>
          </div>
          <div className="space-y-3">
            {(
              [
                { key: "show_bio" as const, label: "Bio", desc: "Show your bio text to visitors" },
                { key: "show_avatar" as const, label: "Avatar", desc: "Show your profile picture" },
                { key: "show_pronouns" as const, label: "Pronouns", desc: "Show your pronouns" },
                { key: "show_location" as const, label: "Location", desc: "Show your location" },
                { key: "show_tags" as const, label: "Interest Tags", desc: "Show your interest tags" },
                { key: "show_bots" as const, label: "Public Bots", desc: "Show your published bots" },
                { key: "show_music" as const, label: "Music", desc: "Show your music/soundtrack" },
                { key: "show_connections_count" as const, label: "Connections Count", desc: "Show how many connections you have" },
                { key: "show_join_date" as const, label: "Join Date", desc: "Show when you joined" },
              ] as const
            ).map(({ key, label, desc }) => (
              <label key={key} className="flex items-center justify-between gap-4 cursor-pointer group">
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-purple-300 transition">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrivacyToggle(key)}
                  disabled={savingPrivacy}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${privacy[key] ? "bg-purple-600" : "bg-gray-700"}`}
                  aria-pressed={privacy[key]}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${privacy[key] ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>

        {/* Section Order */}
        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Profile Section Order</h2>
            <p className="mt-1 text-sm text-gray-400">
              Reorder sections on your public profile. Changes save instantly.
            </p>
          </div>
          <div className="space-y-2">
            {sectionOrder.map((section, idx) => {
              const labels: Record<string, string> = {
                bio: "Bio",
                tags: "Interest Tags",
                music: "Music",
                bots: "Public Bots",
                personas: "Personas",
                guestbook: "Guestbook",
              }
              return (
                <div key={section} className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-700 rounded-lg">
                  <span className="text-gray-400 text-xs w-5 text-center">{idx + 1}</span>
                  <span className="flex-1 text-sm text-white font-medium">{labels[section] ?? section}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveSectionUp(idx)}
                      disabled={idx === 0 || savingSectionOrder}
                      className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSectionDown(idx)}
                      disabled={idx === sectionOrder.length - 1 || savingSectionOrder}
                      className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
