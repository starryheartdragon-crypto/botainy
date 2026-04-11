'use client'

import { Persona } from '@/types'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RelationshipContextPanel, RelationshipData } from './RelationshipContextPanel'

interface PersonaSelectorProps {
  onSelectPersona: (personaId: string | null) => void
  selectedPersonaId?: string | null
  botName?: string
  personaName?: string | null
  chatId?: string
  relationshipData?: RelationshipData
  onRelationshipChange?: (data: Partial<RelationshipData>) => void
  onRelationshipSave?: (data: Partial<RelationshipData>) => void
  token?: string | null
  // Legacy props kept for compatibility – no longer rendered
  relationshipContext?: string | null
  onRelationshipUpdate?: (value: string) => void
}

export function PersonaSelector({
  onSelectPersona,
  selectedPersonaId,
  botName,
  personaName,
  chatId,
  relationshipData,
  onRelationshipChange,
  onRelationshipSave,
  token,
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)

  const isTtrpgPersona = (description: string | undefined) =>
    (description ?? "").startsWith("TTRPG Persona Sheet")

  useEffect(() => {
    fetchPersonas()
  }, [])

  const fetchPersonas = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
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
      setPersonas(data)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400">Loading personas...</div>
  }

  return (
    <div className="border-b border-gray-800 bg-gray-950">
      <div className="p-4">
        <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
          Chat as
        </label>
        <select
          value={selectedPersonaId || ''}
          onChange={(e) => onSelectPersona(e.target.value || null)}
          className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-30 transition"
        >
          <option value="">Your Profile</option>
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
                {isTtrpgPersona(persona.description) ? `${persona.name} [TTRPG]` : persona.name}
            </option>
          ))}
        </select>
        {loading && <p className="text-xs text-gray-500 mt-2">Loading personas...</p>}
      </div>

      {selectedPersonaId && relationshipData && chatId && (
        <RelationshipContextPanel
          chatId={chatId}
          botName={botName ?? 'the bot'}
          personaName={personaName ?? null}
          data={relationshipData}
          onChange={(partial) => onRelationshipChange?.(partial)}
          onSave={(partial) => onRelationshipSave?.(partial)}
          token={token ?? null}
        />
      )}

      {selectedPersonaId && !relationshipData && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-600 italic">Loading relationship data…</p>
        </div>
      )}
    </div>
  )
}
