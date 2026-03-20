-- Add api_temperature column to chats and group_chats tables
-- Allows per-chat temperature settings that persist across sessions

ALTER TABLE chats ADD COLUMN IF NOT EXISTS api_temperature FLOAT DEFAULT 0.9;
ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS api_temperature FLOAT DEFAULT 0.9;
