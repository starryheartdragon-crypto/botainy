-- Add corebook_name and corebook_url to group_chats
-- These fields allow TTRPG groups to reference an external rulebook/SRD.
-- The DM bot's system prompt will include these as a reference directive,
-- guiding the LLM to use that ruleset for encounter stats and rulings.

ALTER TABLE group_chats
  ADD COLUMN IF NOT EXISTS corebook_name text,
  ADD COLUMN IF NOT EXISTS corebook_url  text;
