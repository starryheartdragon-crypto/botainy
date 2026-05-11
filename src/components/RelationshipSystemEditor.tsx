'use client'

import { useState } from 'react'
import { ARC_PRESETS, RelationshipTrack, BotMilestone, BotRelationshipConfig } from '@/app/api/bots/[botId]/relationship-config/route'

const ARC_PRESET_LABELS: Record<string, string> = {
  romance: 'Romance Arc',
  rivalry: 'Rivalry Arc',
  mentor: 'Mentor Arc',
  'found-family': 'Found Family Arc',
  default: 'General (default)',
  custom: 'Custom (manual)',
}

const PRESET_OPTIONS = Object.keys(ARC_PRESET_LABELS)

const STAGE_COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#fb923c', '#fbbf24', '#9ca3af',
  '#d1d5db', '#93c5fd', '#60a5fa', '#a78bfa', '#c084fc', '#f472b6', '#ec4899', '#34d399',
]

interface RelationshipSystemEditorProps {
  botId?: string
  initialConfig?: BotRelationshipConfig | null
  onChange: (config: BotRelationshipConfig) => void
}

const DEFAULT_TRACK: RelationshipTrack = {
  name: 'Relationship',
  arc_preset: 'default',
  stages: ARC_PRESETS.default,
  thresholds: [],
}

const EMPTY_CONFIG: BotRelationshipConfig = {
  tracks: [{ ...DEFAULT_TRACK }],
  milestones: [],
  batch_every: 5,
}

export default function RelationshipSystemEditor({ initialConfig, onChange }: RelationshipSystemEditorProps) {
  const [config, setConfig] = useState<BotRelationshipConfig>(
    initialConfig ?? EMPTY_CONFIG
  )
  const [expandedTrack, setExpandedTrack] = useState<number | null>(0)
  const [expandedMilestones, setExpandedMilestones] = useState(false)

  function update(next: BotRelationshipConfig) {
    setConfig(next)
    onChange(next)
  }

  function addTrack() {
    if (config.tracks.length >= 3) return
    const next = { ...config, tracks: [...config.tracks, { ...DEFAULT_TRACK, name: '' }] }
    update(next)
    setExpandedTrack(config.tracks.length)
  }

  function removeTrack(idx: number) {
    const tracks = config.tracks.filter((_, i) => i !== idx)
    const milestones = config.milestones.filter((m) => m.track_index !== idx).map((m) => ({
      ...m,
      track_index: m.track_index > idx ? m.track_index - 1 : m.track_index,
    }))
    update({ ...config, tracks, milestones })
    setExpandedTrack(null)
  }

  function updateTrack(idx: number, partial: Partial<RelationshipTrack>) {
    const tracks = config.tracks.map((t, i) => (i === idx ? { ...t, ...partial } : t))
    update({ ...config, tracks })
  }

  function applyPreset(idx: number, preset: string) {
    const stages = preset !== 'custom' && ARC_PRESETS[preset] ? ARC_PRESETS[preset] : config.tracks[idx].stages
    updateTrack(idx, { arc_preset: preset === 'custom' ? null : preset, stages })
  }

  function updateStageLabel(trackIdx: number, stageIdx: number, label: string) {
    const stages = config.tracks[trackIdx].stages.map((s, i) => (i === stageIdx ? { ...s, label } : s))
    updateTrack(trackIdx, { stages })
  }

  function updateStageColor(trackIdx: number, stageIdx: number, color: string) {
    const stages = config.tracks[trackIdx].stages.map((s, i) => (i === stageIdx ? { ...s, color } : s))
    updateTrack(trackIdx, { stages })
  }

  function addThreshold(trackIdx: number) {
    const thresholds = [...config.tracks[trackIdx].thresholds, { score: 50, above: true, instruction: '' }]
    updateTrack(trackIdx, { thresholds })
  }

  function updateThreshold(trackIdx: number, tIdx: number, partial: Partial<RelationshipTrack['thresholds'][0]>) {
    const thresholds = config.tracks[trackIdx].thresholds.map((t, i) => (i === tIdx ? { ...t, ...partial } : t))
    updateTrack(trackIdx, { thresholds })
  }

  function removeThreshold(trackIdx: number, tIdx: number) {
    const thresholds = config.tracks[trackIdx].thresholds.filter((_, i) => i !== tIdx)
    updateTrack(trackIdx, { thresholds })
  }

  function addMilestone() {
    const m: BotMilestone = {
      id: crypto.randomUUID(),
      track_index: 0,
      score: 75,
      name: '',
      description: '',
    }
    update({ ...config, milestones: [...config.milestones, m] })
  }

  function updateMilestone(idx: number, partial: Partial<BotMilestone>) {
    const milestones = config.milestones.map((m, i) => (i === idx ? { ...m, ...partial } : m))
    update({ ...config, milestones })
  }

  function removeMilestone(idx: number) {
    update({ ...config, milestones: config.milestones.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Relationship System</h3>
          <p className="text-xs text-gray-500 mt-0.5">Define how your bot tracks relationships with each user persona across a chat.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">AI analysis every</label>
          <select
            value={config.batch_every}
            onChange={(e) => update({ ...config, batch_every: Number(e.target.value) as 3 | 5 | 10 })}
            className="px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:border-purple-500 focus:outline-none"
          >
            <option value={3}>3 messages</option>
            <option value={5}>5 messages</option>
            <option value={10}>10 messages</option>
          </select>
        </div>
      </div>

      {/* Tracks */}
      <div className="space-y-3">
        {config.tracks.map((track, trackIdx) => (
          <div key={trackIdx} className="border border-gray-700 rounded-xl overflow-hidden">
            {/* Track header */}
            <button
              type="button"
              onClick={() => setExpandedTrack(expandedTrack === trackIdx ? null : trackIdx)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">Track {trackIdx + 1}</span>
                <span className="text-sm font-semibold text-white">{track.name || <span className="text-gray-500 italic">Unnamed track</span>}</span>
                {track.arc_preset && track.arc_preset !== 'custom' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded border border-purple-700/40">
                    {ARC_PRESET_LABELS[track.arc_preset] ?? track.arc_preset}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {config.tracks.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeTrack(trackIdx) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeTrack(trackIdx) } }}
                    className="text-xs text-red-500 hover:text-red-400 transition px-1"
                  >
                    Remove
                  </span>
                )}
                <span className="text-gray-500">{expandedTrack === trackIdx ? '▲' : '▼'}</span>
              </div>
            </button>

            {expandedTrack === trackIdx && (
              <div className="px-4 py-4 bg-gray-950 space-y-5">
                {/* Track name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Track Name</label>
                  <input
                    type="text"
                    value={track.name}
                    onChange={(e) => updateTrack(trackIdx, { name: e.target.value })}
                    placeholder="e.g. Trust, Romantic Tension, Rivalry"
                    maxLength={40}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* Arc preset */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Arc Preset</label>
                  <select
                    value={track.arc_preset ?? 'custom'}
                    onChange={(e) => applyPreset(trackIdx, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    {PRESET_OPTIONS.map((p) => (
                      <option key={p} value={p}>{ARC_PRESET_LABELS[p]}</option>
                    ))}
                  </select>
                </div>

                {/* Stage labels */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Stage Labels & Colors</label>
                  <div className="space-y-2">
                    {track.stages.map((stage, stageIdx) => (
                      <div key={stageIdx} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600 w-20 shrink-0 text-right">
                          {stage.min === stage.max ? stage.min : `${stage.min} → ${stage.max}`}
                        </span>
                        <input
                          type="text"
                          value={stage.label}
                          onChange={(e) => updateStageLabel(trackIdx, stageIdx, e.target.value)}
                          maxLength={30}
                          className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:border-purple-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1 flex-wrap w-44 shrink-0">
                          {STAGE_COLOR_OPTIONS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateStageColor(trackIdx, stageIdx, c)}
                              className={`w-4 h-4 rounded-full border-2 transition ${stage.color === c ? 'border-white scale-125' : 'border-transparent'}`}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Thresholds */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score Thresholds</label>
                    {track.thresholds.length < 10 && (
                      <button type="button" onClick={() => addThreshold(trackIdx)} className="text-xs text-purple-400 hover:text-purple-300 transition">+ Add threshold</button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 mb-2">Inject special bot behavior when a score crosses a threshold value.</p>
                  {track.thresholds.length === 0 && (
                    <p className="text-xs text-gray-600 italic">No thresholds — default stage behavior applies.</p>
                  )}
                  <div className="space-y-3">
                    {track.thresholds.map((threshold, tIdx) => (
                      <div key={tIdx} className="border border-gray-700 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">When score goes</span>
                          <select
                            value={threshold.above ? 'above' : 'below'}
                            onChange={(e) => updateThreshold(trackIdx, tIdx, { above: e.target.value === 'above' })}
                            className="px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:outline-none"
                          >
                            <option value="above">above</option>
                            <option value="below">below</option>
                          </select>
                          <input
                            type="number"
                            min={-100}
                            max={100}
                            value={threshold.score}
                            onChange={(e) => updateThreshold(trackIdx, tIdx, { score: Math.max(-100, Math.min(100, Number(e.target.value))) })}
                            className="w-20 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:outline-none"
                          />
                          <button type="button" onClick={() => removeThreshold(trackIdx, tIdx)} className="ml-auto text-xs text-red-500 hover:text-red-400 transition">Remove</button>
                        </div>
                        <textarea
                          value={threshold.instruction}
                          onChange={(e) => updateThreshold(trackIdx, tIdx, { instruction: e.target.value })}
                          rows={2}
                          maxLength={300}
                          placeholder={`e.g. "At this trust level, ${track.name.toLowerCase() || 'the relationship'} is high enough that you may reveal your secret backstory."`}
                          className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:border-purple-500 focus:outline-none resize-none placeholder-gray-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {config.tracks.length < 3 && (
          <button
            type="button"
            onClick={addTrack}
            className="w-full py-2.5 border border-dashed border-gray-700 rounded-xl text-sm text-gray-500 hover:text-purple-400 hover:border-purple-600 transition"
          >
            + Add relationship track ({config.tracks.length}/3)
          </button>
        )}
      </div>

      {/* Milestones */}
      <div className="border border-gray-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedMilestones((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition text-left"
        >
          <div>
            <span className="text-sm font-semibold text-white">Creator Milestones</span>
            {config.milestones.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">({config.milestones.length} defined)</span>
            )}
          </div>
          <span className="text-gray-500">{expandedMilestones ? '▲' : '▼'}</span>
        </button>

        {expandedMilestones && (
          <div className="px-4 py-4 bg-gray-950 space-y-3">
            <p className="text-xs text-gray-500">Define named milestone events at specific score values. These are logged silently to the relationship panel when reached.</p>
            {config.milestones.length === 0 && (
              <p className="text-xs text-gray-600 italic">No creator milestones. Stage-crossing milestones are auto-generated.</p>
            )}
            {config.milestones.map((m, idx) => (
              <div key={m.id} className="border border-gray-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={m.track_index}
                    onChange={(e) => updateMilestone(idx, { track_index: Number(e.target.value) })}
                    className="px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:outline-none"
                  >
                    {config.tracks.map((t, ti) => (
                      <option key={ti} value={ti}>{t.name || `Track ${ti + 1}`}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">score reaches</span>
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    value={m.score}
                    onChange={(e) => updateMilestone(idx, { score: Math.max(-100, Math.min(100, Number(e.target.value))) })}
                    className="w-20 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:outline-none"
                  />
                  <button type="button" onClick={() => removeMilestone(idx)} className="ml-auto text-xs text-red-500 hover:text-red-400 transition">Remove</button>
                </div>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateMilestone(idx, { name: e.target.value })}
                  placeholder="Milestone name (e.g. First Kiss, Sworn Enemy)"
                  maxLength={60}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:border-purple-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={m.description}
                  onChange={(e) => updateMilestone(idx, { description: e.target.value })}
                  placeholder="Short description of what this milestone means"
                  maxLength={150}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 text-white text-xs rounded focus:border-purple-500 focus:outline-none"
                />
              </div>
            ))}
            {config.milestones.length < 20 && (
              <button type="button" onClick={addMilestone} className="text-xs text-purple-400 hover:text-purple-300 transition">+ Add milestone</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
