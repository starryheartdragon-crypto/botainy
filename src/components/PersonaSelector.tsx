'use client'

import { Persona } from '@/types'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface PersonaSelectorProps {
  onSelectPersona: (personaId: string | null) => void
  selectedPersonaId?: string | null
  relationshipContext?: string | null
  onRelationshipChange?: (value: string) => void
  onRelationshipSave?: (value: string) => void
}

export function PersonaSelector({
  onSelectPersona,
  selectedPersonaId,
  relationshipContext,
  onRelationshipChange,
  onRelationshipSave,
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const relRef = useRef<HTMLTextAreaElement>(null)

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

      {selectedPersonaId && (
        <div className="px-4 pb-4">
          <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
            Relationship context <span className="normal-case font-normal text-gray-500">(how {bot(personas, selectedPersonaId)} relates to your persona)</span>
          </label>
          <textarea
            ref={relRef}
            value={relationshipContext ?? ''}
            onChange={(e) => onRelationshipChange?.(e.target.value)}
            onBlur={(e) => onRelationshipSave?.(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder={`e.g. "Dunk is in love with her but believes he doesn't deserve her \u2014 he's tender and protective but always stops himself just before closing the distance."`}
            className="w-full px-3 py-2 bg-gray-900 text-white text-sm rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-30 transition resize-none placeholder-gray-600"
          />
          <p className="text-[10px] text-gray-600 mt-1 text-right">{(relationshipContext ?? '').length}/400</p>
        </div>
      )}
    </div>
  )
}

function bot(personas: Persona[], selectedId: string | null | undefined): string {
  const found = personas.find((p) => p.id === selectedId)
  return found ? found.name : 'the bot'
}
