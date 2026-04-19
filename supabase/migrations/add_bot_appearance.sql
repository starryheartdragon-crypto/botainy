-- Add appearance column to bots table
-- This stores the bot's physical appearance description separately from personality,
-- so it can be explicitly injected into the AI system prompt.
ALTER TABLE bots
ADD COLUMN IF NOT EXISTS appearance TEXT;
