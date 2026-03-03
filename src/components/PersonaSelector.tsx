'use client'

import { Persona } from '@/types'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PersonaSelectorProps {
  onSelectPersona: (personaId: string | null) => void
  selectedPersonaId?: string | null
}

export function PersonaSelector({ onSelectPersona, selectedPersonaId }: PersonaSelectorProps) {
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
    <div className="border-b border-gray-800 p-4 bg-gray-950">
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
  )
}
