-- Add relationship_context column to chats table.
-- This stores a freeform description of how the bot relates to the persona
-- in this specific 1-on-1 chat (e.g. "Dunk is in love with her but thinks he doesn't deserve her").
ALTER TABLE chats ADD COLUMN IF NOT EXISTS relationship_context TEXT;
