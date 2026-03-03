ALTER TABLE group_chats
  ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'general' CHECK (group_type IN ('general', 'roleplay', 'ttrpg')),
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS universe TEXT,
  ADD COLUMN IF NOT EXISTS dm_mode TEXT CHECK (dm_mode IN ('user', 'bot')),
  ADD COLUMN IF NOT EXISTS dm_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dm_bot_id UUID REFERENCES bots(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS group_chat_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_chat_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_bots_group_id ON group_chat_bots(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_bots_bot_id ON group_chat_bots(bot_id);

ALTER TABLE group_chat_bots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_chat_bots'
      AND policyname = 'Members can view group bots'
  ) THEN
    CREATE POLICY "Members can view group bots"
      ON group_chat_bots FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM group_chat_members
          WHERE group_chat_members.group_chat_id = group_chat_bots.group_chat_id
            AND group_chat_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_chat_bots'
      AND policyname = 'Group creators can add bots'
  ) THEN
    CREATE POLICY "Group creators can add bots"
      ON group_chat_bots FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM group_chats
          WHERE group_chats.id = group_chat_bots.group_chat_id
            AND group_chats.creator_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_chat_bots'
      AND policyname = 'Group creators can remove bots'
  ) THEN
    CREATE POLICY "Group creators can remove bots"
      ON group_chat_bots FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM group_chats
          WHERE group_chats.id = group_chat_bots.group_chat_id
            AND group_chats.creator_id = auth.uid()
        )
      );
  END IF;
END $$;