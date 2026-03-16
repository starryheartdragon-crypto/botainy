-- Add missing universe and era columns to chat_rooms table
ALTER TABLE chat_rooms
ADD COLUMN IF NOT EXISTS universe TEXT,
ADD COLUMN IF NOT EXISTS era TEXT;
