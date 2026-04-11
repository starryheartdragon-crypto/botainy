"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { scoreToStage } from "@/components/RelationshipContextPanel"

type PersonaOption = {
  id: string
  name: string
  description: string
  avatar_url: string | null
}

interface PersonaPromptModalProps {
  open: boolean
  title?: string
}

function sliderBackground(score: number): string {
  const pct = ((score + 100) / 200) * 100
  if (pct < 50) {
    return `linear-gradient(to right, #ef4444 0%, #d1d5db ${pct}%, #374151 ${pct}%)`
  }
  return `linear-gradient(to right, #374151 0%, #374151 50%, #a78bfa ${pct}%, #ec4899 100%)`
}

export function PersonaPromptModal({
  open,
  title = "Choose a Persona",
  onCancel,
  onConfirm,
}: PersonaPromptModalProps & {
  onCancel: () => void
  onConfirm: (personaId: string | null, score: number, relationshipContext: string) => void
}) {
  const [personas, setPersonas] = useState<PersonaOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("")
  const [score, setScore] = useState(0)
  const [relationshipContext, setRelationshipContext] = useState("")

  const isTtrpgPersona = (description: string | undefined) =>
    (description ?? "").startsWith("TTRPG Persona Sheet")

  useEffect(() => {
    if (!open) return

    const load = async () => {
      setLoading(true)
      try {
        const { data: { session }, } = await supabase.auth.getSession()

        if (!session?.access_token) {
          setPersonas([])
          return
        }

        const resp = await fetch('/api/personas', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!resp.ok) {
          setPersonas([])
          return
        }

        const payload = await resp.json()
        const data = Array.isArray(payload?.personas) ? payload.personas : []

        setPersonas(data as PersonaOption[])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [open])

  useEffect(() => {
    if (open) {
      setScore(0)
      setRelationshipContext("")
      setSelectedPersonaId("")
    }
  }, [open])

  if (!open) return null

  const stage = scoreToStage(score)
  const scoreLabel = `${score > 0 ? '+' : ''}${score}`

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">Choose who you want to chat as.</p>

        {loading ? (
          <div className="text-sm text-gray-400">Loading personas...</div>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedPersonaId("")}
              className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                selectedPersonaId === ""
                  ? "border-blue-500 bg-blue-500/10 text-white"
                  : "border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500"
              }`}
            >
              Use Profile
            </button>

            {personas.map((persona) => (
              <button
                key={persona.id}
                type="button"
                onClick={() => setSelectedPersonaId(persona.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition flex items-center gap-3 ${
                  selectedPersonaId === persona.id
                    ? "border-blue-500 bg-blue-500/10 text-white"
                    : "border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500"
                }`}
              >
                {persona.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={persona.avatar_url} alt={persona.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700" />
                )}
                <span className="truncate">{persona.name}</span>
                {isTtrpgPersona(persona.description) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-700 bg-emerald-900/40 text-emerald-200">
                    TTRPG
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Relationship — only shown when a persona is selected */}
        {selectedPersonaId && (
          <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
            {/* Score slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-red-400">Archrivals</span>
                <span className="text-xs font-bold" style={{ color: stage.color }}>
                  {stage.label}&nbsp;({scoreLabel})
                </span>
                <span className="text-[11px] text-pink-400">Lovers</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: sliderBackground(score) }}
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>-100</span><span>0</span><span>+100</span>
              </div>
            </div>

            {/* Shared history */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                Shared History <span className="font-normal normal-case text-gray-600">(optional)</span>
              </label>
              <textarea
                value={relationshipContext}
                onChange={(e) => setRelationshipContext(e.target.value)}
                rows={2}
                maxLength={600}
                placeholder="e.g. Old rivals who reluctantly became allies, unspoken tension…"
                className="w-full px-3 py-2 bg-gray-950 text-white text-xs rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition resize-none placeholder-gray-600"
              />
              <div className="text-right text-[10px] text-gray-600">{relationshipContext.length}/600</div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full border border-gray-700 text-gray-300 hover:border-gray-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedPersonaId || null, score, relationshipContext)}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

