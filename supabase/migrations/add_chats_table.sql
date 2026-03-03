-- Create chats table for 1:1 user-bot conversations
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure quick lookup by owner/bot
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_bot_id ON chats(bot_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);

-- Prevent duplicate chats per user+bot+persona (persona null treated as one bucket)
CREATE UNIQUE INDEX IF NOT EXISTS uq_chats_user_bot_persona
ON chats(user_id, bot_id, COALESCE(persona_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Ensure chat_messages.chat_id references chats(id) when chat_messages exists
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chat_messages_chat_id_fkey'
    ) THEN
      ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_chat_id_fkey
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;
