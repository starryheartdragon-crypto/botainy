-- Add per-chat tone override to chats and group_chats
-- Add default tone to bots (bot creator sets a default; users can override per-chat)
--
-- chat_tone: freeform VARCHAR, stores either a preset label (e.g. 'Romantic', 'Dark')
--            or a custom user-supplied tone description.
-- default_tone: same format, set by the bot creator as the baseline tone.

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS chat_tone VARCHAR(200) DEFAULT NULL;

ALTER TABLE group_chats
  ADD COLUMN IF NOT EXISTS chat_tone VARCHAR(200) DEFAULT NULL;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS default_tone VARCHAR(200) DEFAULT NULL;
