-- Migration: Add is_nsfw column to chats, chat_rooms, and group_chats

-- Add to chats table
ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN NOT NULL DEFAULT FALSE;

-- Add to chat_rooms table
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN NOT NULL DEFAULT FALSE;

-- Add to group_chats table
ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN NOT NULL DEFAULT FALSE;
