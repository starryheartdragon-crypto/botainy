-- Extend chat_persona_relationships with multi-track scores, achieved milestones,
-- and a message counter used to trigger AI batch analysis every N messages.

-- track_scores: JSONB array parallel to bot_relationship_config.tracks
-- Each element: { score: number }  (index 0 = track 0, etc.)
ALTER TABLE chat_persona_relationships
  ADD COLUMN IF NOT EXISTS track_scores       JSONB        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS milestones_achieved JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS messages_since_analysis INTEGER NOT NULL DEFAULT 0;

-- milestones_achieved elements: { milestone_id: string, achieved_at: string, track_index: number, score: number, name: string }
