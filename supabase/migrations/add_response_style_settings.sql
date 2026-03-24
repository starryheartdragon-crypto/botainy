-- Add response length and narrative style settings to chats and group_chats
-- response_length: 0 = shorter, 1 = default, 2 = longer
-- narrative_style: 0 = dialogue-heavy, 1 = balanced, 2 = narrative-heavy

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS response_length SMALLINT DEFAULT 1 CHECK (response_length >= 0 AND response_length <= 2),
  ADD COLUMN IF NOT EXISTS narrative_style SMALLINT DEFAULT 1 CHECK (narrative_style >= 0 AND narrative_style <= 2);

ALTER TABLE group_chats
  ADD COLUMN IF NOT EXISTS response_length SMALLINT DEFAULT 1 CHECK (response_length >= 0 AND response_length <= 2),
  ADD COLUMN IF NOT EXISTS narrative_style SMALLINT DEFAULT 1 CHECK (narrative_style >= 0 AND narrative_style <= 2);
