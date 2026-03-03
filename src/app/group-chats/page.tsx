'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PersonaPromptModal } from '@/components/PersonaPromptModal'

type GroupChatType = 'general' | 'roleplay' | 'ttrpg'

interface GroupChat {
  id: string
  name: string
  description: string | null
  visibility: 'public' | 'private'
  created_at: string
}

interface ConnectionOption {
  id: string
  username: string | null
}

interface BotOption {
  id: string
  name: string
  universe: string | null
}

export default function GroupChatsPage() {
  const router = useRouter()
  const [groupChats, setGroupChats] = useState<GroupChat[]>([])
  const [loading, setLoading] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null)
  const [joinedIds, setJoinedIds] = useState<Record<string, boolean>>({})
  const [personaPromptOpen, setPersonaPromptOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ type: 'join' | 'open'; groupChatId: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [connectionOptions, setConnectionOptions] = useState<ConnectionOption[]>([])
  const [botOptions, setBotOptions] = useState<BotOption[]>([])
  const [userToAdd, setUserToAdd] = useState('')
  const [botToAdd, setBotToAdd] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [groupType, setGroupType] = useState<GroupChatType>('general')
  const [rules, setRules] = useState('')
  const [universe, setUniverse] = useState('')
  const [dmMode, setDmMode] = useState<'user' | 'bot'>('user')
  const [dmUserId, setDmUserId] = useState('')
  const [dmBotId, setDmBotId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([])

  const sortedGroups = useMemo(
    () => [...groupChats].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [groupChats]
  )

  const availableUsers = useMemo(
    () => connectionOptions.filter((user) => !selectedUserIds.includes(user.id)),
    [connectionOptions, selectedUserIds]
  )

  const availableBots = useMemo(
    () => botOptions.filter((bot) => !selectedBotIds.includes(bot.id)),
    [botOptions, selectedBotIds]
  )

  const dmUserOptions = useMemo(() => {
    const invitedUsers = selectedUserIds
      .map((id) => connectionOptions.find((user) => user.id === id))
      .filter((value): value is ConnectionOption => Boolean(value))

    return [
      ...(currentUserId
        ? [
            {
              id: currentUserId,
              username: 'You',
            },
          ]
        : []),
      ...invitedUsers,
    ]
  }, [connectionOptions, currentUserId, selectedUserIds])

  const loadGroupChats = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = {}
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    const resp = await fetch('/api/group-chats', { headers })
    if (resp.ok) {
      const data = await resp.json()
      setGroupChats(Array.isArray(data) ? data : [])
    }
  }

  const loadCreateOptions = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setCurrentUserId(session?.user?.id ?? null)

    if (!session?.access_token) {
      setConnectionOptions([])
      setBotOptions([])
      return
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${session.access_token}`,
    }

    const [connectionsResp, mineBotsResp, publicBotsResp] = await Promise.all([
      fetch('/api/connections', { headers }),
      fetch('/api/bots?scope=mine', { headers }),
      fetch('/api/bots'),
    ])

    if (connectionsResp.ok) {
      const payload = await connectionsResp.json()
      const connections = Array.isArray(payload?.connections) ? payload.connections : []

      setConnectionOptions(
        connections
          .map((entry: { user?: { id?: string; username?: string | null } }) => ({
            id: String(entry?.user?.id || ''),
            username: entry?.user?.username ?? null,
          }))
          .filter((entry: ConnectionOption) => entry.id.length > 0)
      )
    }

    const mineBotsPayload = mineBotsResp.ok ? await mineBotsResp.json() : { bots: [] }
    const publicBotsPayload = publicBotsResp.ok ? await publicBotsResp.json() : { bots: [] }
    const mineBots = Array.isArray(mineBotsPayload?.bots) ? mineBotsPayload.bots : []
    const publicBots = Array.isArray(publicBotsPayload?.bots) ? publicBotsPayload.bots : []
    const mergedBots = [...mineBots, ...publicBots]
    const uniqueBots = Array.from(new Map(mergedBots.map((bot) => [bot.id, bot])).values())

    setBotOptions(
      uniqueBots
        .map((bot: { id?: string; name?: string; universe?: string | null }) => ({
          id: String(bot.id || ''),
          name: String(bot.name || 'Unnamed bot'),
          universe: bot.universe ?? null,
        }))
        .filter((bot: BotOption) => bot.id.length > 0)
    )
  }

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([loadGroupChats(), loadCreateOptions()])
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreateError(null)

    if (selectedUserIds.length > 4) {
      setCreateError('You can add up to 4 other users.')
      return
    }

    if (selectedBotIds.length > 12) {
      setCreateError('You can add up to 12 bots.')
      return
    }

    if (groupType === 'ttrpg') {
      if (!rules.trim()) {
        setCreateError('TTRPG chats require rules.')
        return
      }

      if (dmMode === 'user') {
        if (!dmUserId) {
          setCreateError('Choose a DM user for TTRPG chats.')
          return
        }
      } else if (!dmBotId) {
        setCreateError('Choose a DM bot for TTRPG chats.')
        return
      }
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      window.location.href = '/login'
      return
    }

    try {
      setCreateLoading(true)
      const resp = await fetch('/api/group-chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
          groupType,
          rules: groupType === 'general' ? null : rules.trim() || null,
          universe: groupType === 'roleplay' ? universe.trim() || null : null,
          dmMode: groupType === 'ttrpg' ? dmMode : null,
          dmUserId: groupType === 'ttrpg' && dmMode === 'user' ? dmUserId : null,
          dmBotId: groupType === 'ttrpg' && dmMode === 'bot' ? dmBotId : null,
          invitedUserIds: selectedUserIds,
          botIds: selectedBotIds,
        }),
      })

      if (resp.ok) {
        setName('')
        setDescription('')
        setVisibility('private')
        setGroupType('general')
        setRules('')
        setUniverse('')
        setDmMode('user')
        setDmUserId('')
        setDmBotId('')
        setSelectedUserIds([])
        setSelectedBotIds([])
        await loadGroupChats()
      } else {
        const payload = await resp.json().catch(() => ({}))
        setCreateError(payload?.error || 'Failed to create group chat.')
      }
    } finally {
      setCreateLoading(false)
    }
  }

  const addSelectedUser = () => {
    if (!userToAdd || selectedUserIds.length >= 4) return
    setSelectedUserIds((prev) => [...prev, userToAdd])
    setUserToAdd('')
  }

  const addSelectedBot = () => {
    if (!botToAdd || selectedBotIds.length >= 12) return
    setSelectedBotIds((prev) => [...prev, botToAdd])
    setBotToAdd('')
  }

  const handleJoin = async (groupChatId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      window.location.href = '/login'
      return
    }

    try {
      setJoinLoadingId(groupChatId)
      const resp = await fetch(`/api/group-chats/${groupChatId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (resp.ok) {
        setJoinedIds((prev) => ({ ...prev, [groupChatId]: true }))
      }
    } finally {
      setJoinLoadingId(null)
    }
  }

  const handleOpenGroup = async (groupChatId: string) => {
    await handleJoin(groupChatId)
    router.push(`/group-chats/${groupChatId}`)
  }

  const handleWithPersonaPrompt = (action: { type: 'join' | 'open'; groupChatId: string }) => {
    setPendingAction(action)
    setPersonaPromptOpen(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Group Chats</h1>
          <p className="text-sm sm:text-base text-gray-300">
            Private/small group conversations, separate from public chat rooms.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 bg-gray-900/60 border border-gray-700 rounded-xl p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
          />
          <div className="flex gap-2">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-60"
            >
              {createLoading ? '...' : 'Create'}
            </button>
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as GroupChatType)}
              className="px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
            >
              <option value="general">General Chat</option>
              <option value="roleplay">Roleplay</option>
              <option value="ttrpg">TTRPG</option>
            </select>

            <div className="text-xs text-gray-400 flex items-center px-2">
              Add up to 4 users and 12 bots at creation.
            </div>
          </div>

          {(groupType === 'roleplay' || groupType === 'ttrpg') && (
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder={groupType === 'ttrpg' ? 'Campaign rules (required)' : 'Rules (optional)'}
                className="md:col-span-2 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white min-h-[88px]"
              />

              {groupType === 'roleplay' && (
                <input
                  value={universe}
                  onChange={(e) => setUniverse(e.target.value)}
                  placeholder="Universe (optional)"
                  className="px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
                />
              )}

              {groupType === 'ttrpg' && (
                <div className="flex gap-2">
                  <select
                    value={dmMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as 'user' | 'bot'
                      setDmMode(nextMode)
                      setDmUserId('')
                      setDmBotId('')
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
                  >
                    <option value="user">User DM</option>
                    <option value="bot">Bot DM</option>
                  </select>

                  {dmMode === 'user' ? (
                    <select
                      value={dmUserId}
                      onChange={(e) => setDmUserId(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
                    >
                      <option value="">Select DM user</option>
                      {dmUserOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username || 'Unknown user'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={dmBotId}
                      onChange={(e) => setDmBotId(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
                    >
                      <option value="">Select DM bot</option>
                      {selectedBotIds
                        .map((botId) => botOptions.find((bot) => bot.id === botId))
                        .filter((value): value is BotOption => Boolean(value))
                        .map((bot) => (
                          <option key={bot.id} value={bot.id}>
                            {bot.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Other users ({selectedUserIds.length}/4)</p>
              <div className="flex gap-2">
                <select
                  value={userToAdd}
                  onChange={(e) => setUserToAdd(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
                >
                  <option value="">Select connection</option>
                  {availableUsers.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.username || 'Unknown user'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addSelectedUser}
                  disabled={!userToAdd || selectedUserIds.length >= 4}
                  className="px-4 py-2 rounded-full border border-gray-600 hover:border-gray-400 disabled:opacity-60"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedUserIds.map((id) => {
                  const entry = connectionOptions.find((user) => user.id === id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedUserIds((prev) => prev.filter((userId) => userId !== id))
                        if (dmUserId === id) {
                          setDmUserId('')
                        }
                      }}
                      className="text-xs px-3 py-1 rounded-full border border-gray-600 hover:border-red-400"
                    >
                      {entry?.username || 'Unknown user'} ×
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400">Bots ({selectedBotIds.length}/12)</p>
              <div className="flex gap-2">
                <select
                  value={botToAdd}
                  onChange={(e) => setBotToAdd(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white"
                >
                  <option value="">Select bot</option>
                  {availableBots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                      {bot.universe ? ` (${bot.universe})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addSelectedBot}
                  disabled={!botToAdd || selectedBotIds.length >= 12}
                  className="px-4 py-2 rounded-full border border-gray-600 hover:border-gray-400 disabled:opacity-60"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedBotIds.map((id) => {
                  const bot = botOptions.find((entry) => entry.id === id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedBotIds((prev) => prev.filter((botId) => botId !== id))
                        if (dmBotId === id) {
                          setDmBotId('')
                        }
                      }}
                      className="text-xs px-3 py-1 rounded-full border border-gray-600 hover:border-red-400"
                    >
                      {bot?.name || 'Unknown bot'} ×
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {createError && (
            <div className="md:col-span-3 text-sm text-red-300">{createError}</div>
          )}
        </form>

        {loading ? (
          <div className="text-gray-400">Loading group chats...</div>
        ) : sortedGroups.length === 0 ? (
          <div className="text-gray-400">No group chats yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {sortedGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-gray-700 bg-gray-900/80 p-4 sm:p-5">
                <h2 className="text-lg sm:text-xl font-semibold">{group.name}</h2>
                <p className="text-sm text-gray-300 mt-1 line-clamp-2">{group.description || 'No description.'}</p>
                <p className="text-xs text-gray-400 mt-2">{group.visibility.toUpperCase()}</p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleWithPersonaPrompt({ type: 'join', groupChatId: group.id })}
                    disabled={joinLoadingId === group.id || joinedIds[group.id]}
                    className="px-4 py-2 text-sm rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60"
                  >
                    {joinedIds[group.id] ? 'Joined' : joinLoadingId === group.id ? 'Joining...' : 'Join'}
                  </button>
                  <button
                    onClick={() => handleWithPersonaPrompt({ type: 'open', groupChatId: group.id })}
                    className="px-4 py-2 text-sm rounded-full border border-gray-600 hover:border-gray-400 transition"
                  >
                    Open Group
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PersonaPromptModal
        open={personaPromptOpen}
        title="Choose Persona for Group Chat"
        onCancel={() => {
          setPersonaPromptOpen(false)
          setPendingAction(null)
        }}
        onConfirm={async () => {
          if (!pendingAction) return
          const action = pendingAction
          setPersonaPromptOpen(false)
          setPendingAction(null)

          if (action.type === 'join') {
            await handleJoin(action.groupChatId)
            return
          }

          await handleOpenGroup(action.groupChatId)
        }}
      />
    </div>
  )
}
