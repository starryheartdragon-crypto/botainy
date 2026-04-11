-- Overhaul relationship context in chats table.
-- Adds structured fields alongside the existing free-text relationship_context (now used as backstory).
-- Score range: -100 (archrivals) to 0 (neutral) to 100 (lovers).
-- Tags: dynamic labels like "childhood friends", "rivals turned allies".
-- Events: JSONB array of { id, date, description } milestones.
-- Summary: AI-generated narrative summary of the relationship dynamic.

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER DEFAULT 0
    CHECK (relationship_score >= -100 AND relationship_score <= 100),
  ADD COLUMN IF NOT EXISTS relationship_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relationship_events JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS relationship_summary TEXT;
