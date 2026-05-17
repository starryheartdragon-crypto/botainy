'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface CastPreview {
  universe: string
  groupName: string
  groupDescription: string
  memberNames: string[]
  memberCount: number
}

interface QuickStartModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'pick' | 'persona' | 'creating'

interface Persona {
  id: string
  name: string
  description?: string | null
}

export function QuickStartModal({ open, onClose }: QuickStartModalProps) {
  const router = useRouter()

  const [casts, setCasts] = useState<CastPreview[]>([])
  const [loadingCasts, setLoadingCasts] = useState(false)
  const [selected, setSelected] = useState<CastPreview | null>(null)
  const [step, setStep] = useState<Step>('pick')

  const [personas, setPersonas] = useState<Persona[]>([])
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [universeRequestName, setUniverseRequestName] = useState('')
  const [universeRequestDetails, setUniverseRequestDetails] = useState('')
  const [universeRequestLoading, setUniverseRequestLoading] = useState(false)
  const [universeRequestMessage, setUniverseRequestMessage] = useState<string | null>(null)

  const fetchCasts = useCallback(async () => {
    setLoadingCasts(true)
    try {
      const resp = await fetch('/api/quick-start')
      if (resp.ok) {
        const data = await resp.json() as { casts: CastPreview[] }
        setCasts(data.casts ?? [])
      }
    } finally {
      setLoadingCasts(false)
    }
  }, [])

  const fetchPersonas = useCallback(async () => {
    setLoadingPersonas(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setPersonas([]); return }
      const resp = await fetch('/api/personas', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (resp.ok) {
        const payload = await resp.json()
        const list = Array.isArray(payload?.personas) ? payload.personas : []
        setPersonas(list)
      }
    } finally {
      setLoadingPersonas(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void fetchCasts()
    } else {
      // Reset state when closed
      setSelected(null)
      setStep('pick')
      setSelectedPersonaId(null)
      setError(null)
      setCreating(false)
    }
  }, [open, fetchCasts])

  async function handleSelectUniverse(cast: CastPreview) {
    setSelected(cast)
    setStep('persona')
    await fetchPersonas()
  }

  async function handleCreate() {
    if (!selected) return
    setCreating(true)
    setStep('creating')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('You must be signed in to use Quick Start.')
        setCreating(false)
        setStep('persona')
        return
      }

      const resp = await fetch('/api/quick-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          universe: selected.universe,
          selectedPersonaId: selectedPersonaId ?? undefined,
        }),
      })

      const result = await resp.json() as { groupChatId?: string; error?: string }

      if (!resp.ok || !result.groupChatId) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        setCreating(false)
        setStep('persona')
        return
      }

      onClose()
      router.push(`/group-chats/${result.groupChatId}`)
    } catch {
      setError('Network error. Please try again.')
      setCreating(false)
      setStep('persona')
    }
  }

  async function handleSubmitUniverseRequest(e: React.FormEvent) {
    e.preventDefault()
    setUniverseRequestMessage(null)

    const trimmedName = universeRequestName.trim()
    const trimmedDetails = universeRequestDetails.trim()

    if (!trimmedName || !trimmedDetails) {
      setUniverseRequestMessage('Please provide a universe name and request details.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUniverseRequestMessage('You must be signed in to submit a request.')
      return
    }

    try {
      setUniverseRequestLoading(true)
      const { error: insertError } = await supabase.from('bot_universe_requests').insert({
        requester_id: user.id,
        requested_name: trimmedName,
        request_details: trimmedDetails,
      })
      if (insertError) throw insertError
      setUniverseRequestName('')
      setUniverseRequestDetails('')
      setUniverseRequestMessage('Request sent to admin for review.')
    } catch (err) {
      setUniverseRequestMessage(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setUniverseRequestLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-950 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">⚡ Quick Start</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Instantly create a group chat with an iconic cast of characters
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition p-1 rounded-lg hover:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* Step: pick universe */}
          {step === 'pick' && (
            <div className="p-6">
              <p className="text-sm text-gray-400 mb-4">
                Choose a universe to instantly populate a group chat with its main cast. Characters are created automatically — just pick your persona and start chatting.
              </p>
              {loadingCasts ? (
                <div className="text-center text-gray-500 py-12">Loading casts…</div>
              ) : (
                <div className="grid gap-3">
                  {casts.map((cast) => (
                    <button
                      key={cast.universe}
                      onClick={() => void handleSelectUniverse(cast)}
                      className="w-full text-left p-4 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 hover:border-gray-700 transition group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm group-hover:text-purple-300 transition">
                            {cast.groupName}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{cast.universe}</div>
                          <div className="text-xs text-gray-400 mt-1.5 line-clamp-2">
                            {cast.groupDescription}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {cast.memberNames.map((name) => (
                              <span
                                key={name}
                                className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <svg
                          className="text-gray-600 group-hover:text-purple-400 transition shrink-0 mt-1"
                          width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Universe request */}
              <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-1">Don't see your universe?</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Submit a request and admins can add it. Same queue as Bot Creation requests.
                </p>
                <form onSubmit={(e) => void handleSubmitUniverseRequest(e)} className="space-y-2">
                  <input
                    value={universeRequestName}
                    onChange={(e) => setUniverseRequestName(e.target.value)}
                    placeholder="Requested universe name"
                    maxLength={80}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    required
                  />
                  <textarea
                    value={universeRequestDetails}
                    onChange={(e) => setUniverseRequestDetails(e.target.value)}
                    placeholder="What should this universe include for Quick Start?"
                    rows={2}
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-700 text-white text-sm resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    required
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">{universeRequestDetails.length}/500</span>
                    <button
                      type="submit"
                      disabled={universeRequestLoading}
                      className="px-4 py-1.5 text-sm rounded-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-60 transition text-white"
                    >
                      {universeRequestLoading ? 'Sending…' : 'Send Request'}
                    </button>
                  </div>
                  {universeRequestMessage && (
                    <div className="text-xs text-gray-200 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2">
                      {universeRequestMessage}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* Step: pick persona */
          {step === 'persona' && selected && (
            <div className="p-6">
              <button
                onClick={() => setStep('pick')}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-5 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>

              <div className="mb-5 p-4 rounded-xl bg-gray-900 border border-gray-800">
                <div className="font-semibold text-white">{selected.groupName}</div>
                <div className="text-xs text-gray-500">{selected.universe}</div>
                <p className="text-xs text-gray-400 mt-1.5">{selected.groupDescription}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selected.memberNames.map((name) => (
                    <span key={name} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
                  Chat as (optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Pick a persona to represent yourself in this chat, or leave blank to chat as your profile.
                </p>
                {loadingPersonas ? (
                  <div className="text-sm text-gray-500">Loading personas…</div>
                ) : (
                  <select
                    value={selectedPersonaId ?? ''}
                    onChange={(e) => setSelectedPersonaId(e.target.value || null)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">— No persona (chat as yourself) —</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={() => void handleCreate()}
                disabled={creating}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition shadow-lg"
              >
                {creating ? 'Creating your chat…' : `Create chat with ${selected.memberCount} characters →`}
              </button>
            </div>
          )}

          {/* Step: creating */}
          {step === 'creating' && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4 animate-pulse">⚡</div>
              <div className="text-white font-semibold mb-2">Assembling the cast…</div>
              <div className="text-sm text-gray-400">
                Creating characters and setting up relationships. This only takes a moment.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
