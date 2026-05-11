'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'

export type RelationshipEvent = { id: string; date: string; description: string }

export interface TrackScore { score: number }
export interface AchievedMilestone {
  milestone_id: string
  achieved_at: string
  track_index: number
  score: number
  name: string
}

export interface RelationshipTrackConfig {
  name: string
  arc_preset: string | null
  stages: Array<{ min: number; max: number; label: string; color: string }>
  thresholds: Array<{ score: number; above: boolean; instruction: string }>
}

export interface RelationshipData {
  relationship_context: string
  relationship_score: number          // legacy single score (still saved)
  relationship_tags: string[]
  relationship_events: RelationshipEvent[]
  relationship_summary: string | null
  track_scores: TrackScore[]
  milestones_achieved: AchievedMilestone[]
}

// NEW extended props
interface RelationshipContextPanelProps {
  chatId: string
  personaId: string
  botName: string
  personaName: string | null
  data: RelationshipData
  tracks: RelationshipTrackConfig[]
  onChange: (data: Partial<RelationshipData>) => void
  onSave: (data: Partial<RelationshipData>) => void
  token: string | null
}

function stageForScore(
  score: number,
  stages: Array<{ min: number; max: number; label: string; color: string }>
): { label: string; color: string } {
  const s = stages.find((st) => score >= st.min && score <= st.max)
  return s ? { label: s.label, color: s.color } : { label: 'Neutral', color: '#d1d5db' }
}

export function scoreToStage(score: number): { label: string; color: string } {
  if (score <= -76) return { label: 'Archrivals', color: '#ef4444' }
  if (score <= -51) return { label: 'Bitter Enemies', color: '#f97316' }
  if (score <= -26) return { label: 'Rivals', color: '#fb923c' }
  if (score <= -11) return { label: 'Cold Strangers', color: '#9ca3af' }
  if (score <= 10)  return { label: 'Neutral', color: '#d1d5db' }
  if (score <= 25)  return { label: 'Acquaintances', color: '#93c5fd' }
  if (score <= 50)  return { label: 'Friends', color: '#60a5fa' }
  if (score <= 75)  return { label: 'Close Friends', color: '#a78bfa' }
  if (score <= 90)  return { label: 'Deeply Bonded', color: '#c084fc' }
  if (score <= 99)  return { label: 'Devoted', color: '#f472b6' }
  return { label: 'Lovers', color: '#ec4899' }
}

function sliderBackground(score: number): string {
  const pct = ((score + 100) / 200) * 100
  if (pct < 50) {
    return `linear-gradient(to right, #ef4444 0%, #d1d5db ${pct}%, #374151 ${pct}%)`
  }
  return `linear-gradient(to right, #374151 0%, #374151 50%, #a78bfa ${pct}%, #ec4899 100%)`
}

export function RelationshipContextPanel({
  chatId,
  personaId,
  botName,
  personaName,
  data,
  tracks,
  onChange,
  onSave,
  token,
}: RelationshipContextPanelProps) {
  const [open, setOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventDesc, setNewEventDesc] = useState('')
  const [addingEvent, setAddingEvent] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const backstoryRef = useRef<HTMLTextAreaElement>(null)

  const hasMultiTrack = tracks.length > 0 && data.track_scores.length > 0
  const primaryStage = hasMultiTrack
    ? stageForScore(data.track_scores[0]?.score ?? 0, tracks[0].stages)
    : scoreToStage(data.relationship_score)

  const handleTrackScoreChange = (i: number, value: number) => {
    const updated = tracks.map((_, ti) => ({ score: data.track_scores[ti]?.score ?? 0 }))
    updated[i] = { score: value }
    onChange({ track_scores: updated })
  }

  const handleTrackScoreBlur = (i: number, value: number) => {
    const updated = tracks.map((_, ti) => ({ score: data.track_scores[ti]?.score ?? 0 }))
    updated[i] = { score: value }
    onSave({ track_scores: updated })
  }

  const handleScoreChange = (value: number) => onChange({ relationship_score: value })
  const handleScoreBlur = (value: number) => onSave({ relationship_score: value })

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (!tag || data.relationship_tags.includes(tag) || data.relationship_tags.length >= 10) return
    const updated = [...data.relationship_tags, tag]
    onChange({ relationship_tags: updated })
    onSave({ relationship_tags: updated })
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    const updated = data.relationship_tags.filter((t) => t !== tag)
    onChange({ relationship_tags: updated })
    onSave({ relationship_tags: updated })
  }

  const handleBackstoryBlur = (value: string) => {
    onSave({ relationship_context: value.trim() || undefined })
  }

  const handleAddEvent = async () => {
    if (!newEventDesc.trim() || !newEventDate.trim()) return
    if (!token) { toast.error('Not authenticated'); return }
    setAddingEvent(true)
    try {
      const resp = await fetch(`/api/chats/${chatId}/relationship/events?personaId=${encodeURIComponent(personaId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newEventDate.trim(), description: newEventDesc.trim() }),
      })
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error) }
      const { events: updated } = await resp.json()
      onChange({ relationship_events: updated })
      setNewEventDate('')
      setNewEventDesc('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add event')
    } finally {
      setAddingEvent(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!token) return
    try {
      const resp = await fetch(`/api/chats/${chatId}/relationship/events/${eventId}?personaId=${encodeURIComponent(personaId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error()
      const { events: updated } = await resp.json()
      onChange({ relationship_events: updated })
    } catch {
      toast.error('Failed to delete event')
    }
  }

  const handleGenerateSummary = async () => {
    if (!token) { toast.error('Not authenticated'); return }
    setGeneratingSummary(true)
    try {
      const resp = await fetch(`/api/chats/${chatId}/relationship/summary?personaId=${encodeURIComponent(personaId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error) }
      const { summary } = await resp.json()
      onChange({ relationship_summary: summary })
      toast.success('Summary generated!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setGeneratingSummary(false)
    }
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Stage badge(s) */}
      <div className="flex items-center flex-wrap gap-2 pt-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Relationship</span>
        {hasMultiTrack ? (
          tracks.map((track, i) => {
            const s = stageForScore(data.track_scores[i]?.score ?? 0, track.stages)
            return (
              <span key={i} className="text-xs font-bold px-2 py-0.5 rounded-full border"
                style={{ color: s.color, borderColor: s.color + '55', background: s.color + '18' }}
                title={track.name}>
                {track.name}: {s.label}
              </span>
            )
          })
        ) : (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
            style={{ color: primaryStage.color, borderColor: primaryStage.color + '55', background: primaryStage.color + '18' }}>
            {primaryStage.label}
          </span>
        )}
      </div>

      {/* Score Sliders */}
      {hasMultiTrack ? (
        <div className="space-y-3">
          {tracks.map((track, i) => {
            const score = data.track_scores[i]?.score ?? 0
            const stage = stageForScore(score, track.stages)
            const negLabel = track.stages[0]?.label ?? '–'
            const posLabel = track.stages[track.stages.length - 1]?.label ?? '+'
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">{track.name}</span>
                  <span className="text-xs font-bold" style={{ color: stage.color }}>{score > 0 ? '+' : ''}{score}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-16 text-right shrink-0">{negLabel}</span>
                  <input type="range" min={-100} max={100} step={1} value={score}
                    onChange={(e) => handleTrackScoreChange(i, Number(e.target.value))}
                    onMouseUp={(e) => handleTrackScoreBlur(i, Number((e.target as HTMLInputElement).value))}
                    onTouchEnd={(e) => handleTrackScoreBlur(i, Number((e.target as HTMLInputElement).value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{ background: sliderBackground(score) }} />
                  <span className="text-[10px] text-gray-600 w-16 shrink-0">{posLabel}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-red-400">Archrivals</span>
            <span className="text-xs font-bold" style={{ color: primaryStage.color }}>
              {`${data.relationship_score > 0 ? '+' : ''}${data.relationship_score}`}
            </span>
            <span className="text-[11px] text-pink-400">Lovers</span>
          </div>
          <input type="range" min={-100} max={100} step={1} value={data.relationship_score}
            onChange={(e) => handleScoreChange(Number(e.target.value))}
            onMouseUp={(e) => handleScoreBlur(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => handleScoreBlur(Number((e.target as HTMLInputElement).value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ background: sliderBackground(data.relationship_score) }} />
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            <span>-100</span><span>0</span><span>+100</span>
          </div>
        </div>
      )}

      {/* Shared history */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
          Shared History <span className="font-normal normal-case text-gray-600">(optional)</span>
        </label>
        <textarea ref={backstoryRef} value={data.relationship_context}
          onChange={(e) => onChange({ relationship_context: e.target.value })}
          onBlur={(e) => handleBackstoryBlur(e.target.value)}
          rows={2} maxLength={600}
          placeholder={`e.g. "${botName} is deeply protective but won't admit to caring…"`}
          className="w-full px-3 py-2 bg-gray-900 text-white text-xs rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition resize-none placeholder-gray-600" />
        <div className="text-right text-[10px] text-gray-600 mt-0.5">{data.relationship_context.length}/600</div>
      </div>

      {/* Advanced — collapsible */}
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-1 text-left group">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-300 transition">
          Advanced {open ? '▲' : '▼'}
        </span>
        {data.relationship_tags.length > 0 && !open && (
          <span className="text-[10px] text-gray-600">
            {data.relationship_tags.slice(0, 2).join(' · ')}{data.relationship_tags.length > 2 ? ' …' : ''}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 pb-1">
          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {data.relationship_tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 border border-gray-600 rounded-full text-xs text-gray-200">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)}
                    className="text-gray-500 hover:text-red-400 transition leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder='e.g. "childhood friends"' maxLength={40}
                className="flex-1 px-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
              <button type="button" onClick={handleAddTag}
                disabled={!tagInput.trim() || data.relationship_tags.length >= 10}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 text-xs rounded-lg transition">
                + Add
              </button>
            </div>
          </div>

          {/* Memory Log */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Memory Log</label>
            {data.relationship_events.length > 0 && (
              <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto pr-1">
                {data.relationship_events.map((event) => (
                  <div key={event.id} className="flex items-start gap-2 p-2 bg-gray-900/70 border border-gray-700/60 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-gray-500 block">{event.date}</span>
                      <span className="text-xs text-gray-200">{event.description}</span>
                    </div>
                    <button type="button" onClick={() => handleDeleteEvent(event.id)}
                      className="text-gray-600 hover:text-red-400 text-xs transition flex-shrink-0 mt-0.5">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-start">
              <input type="text" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)}
                placeholder="Date/era" maxLength={50}
                className="w-24 px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
              <input type="text" value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEvent())}
                placeholder="What happened?" maxLength={300}
                className="flex-1 px-3 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
              <button type="button" onClick={handleAddEvent}
                disabled={addingEvent || !newEventDesc.trim() || !newEventDate.trim()}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 text-xs rounded-lg transition flex-shrink-0">
                {addingEvent ? '...' : '+ Add'}
              </button>
            </div>
          </div>

          {/* Milestones log */}
          {data.milestones_achieved.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Milestones Reached</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {data.milestones_achieved.map((m) => (
                  <div key={m.milestone_id} className="flex items-center gap-2 p-2 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                    <span className="text-purple-300 text-[11px]">✦</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-purple-200 block">{m.name}</span>
                      {tracks[m.track_index] && (
                        <span className="text-[10px] text-gray-500">
                          {tracks[m.track_index].name} · score {m.score > 0 ? '+' : ''}{m.score}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {new Date(m.achieved_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">AI Relationship Summary</label>
              <button type="button" onClick={handleGenerateSummary} disabled={generatingSummary}
                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs rounded-lg transition">
                {generatingSummary ? 'Generating…' : '✦ Generate'}
              </button>
            </div>
            {data.relationship_summary ? (
              <p className="text-xs text-gray-300 italic bg-gray-900/60 border border-gray-700/50 rounded-lg p-3 leading-relaxed">
                {data.relationship_summary}
              </p>
            ) : (
              <p className="text-xs text-gray-600 italic">
                Generate an AI-written summary of the current emotional dynamic between {botName} and {personaName ?? 'your persona'}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// compat — no longer needed in most paths but kept for any stale import
export { RelationshipContextPanel as default }
