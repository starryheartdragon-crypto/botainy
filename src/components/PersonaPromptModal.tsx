"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type PersonaOption = {
  id: string
  name: string
  description: string
  avatar_url: string | null
}

interface PersonaPromptModalProps {
  open: boolean
  title?: string
  onCancel: () => void
  onConfirm: (personaId: string | null) => void
}

export function PersonaPromptModal({
  open,
  title = "Choose a Persona",
  onCancel,
  onConfirm,
}: PersonaPromptModalProps) {
  const [personas, setPersonas] = useState<PersonaOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("")

  const isTtrpgPersona = (description: string | undefined) =>
    (description ?? "").startsWith("TTRPG Persona Sheet")

  useEffect(() => {
    if (!open) return

    const load = async () => {
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">Choose who you want to chat as.</p>

        {loading ? (
          <div className="text-sm text-gray-400">Loading personas...</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
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
            onClick={() => onConfirm(selectedPersonaId || null)}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
