-- Bestiary: encounter bots pre-linked to a TTRPG group but not yet active.
-- They are NOT in group_chat_bots until summoned by the DM.
-- On defeat they are removed from group_chat_bots but stay here for re-summon.

CREATE TABLE IF NOT EXISTS group_chat_bestiary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_chat_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_bestiary_group_id ON group_chat_bestiary(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_bestiary_bot_id ON group_chat_bestiary(bot_id);

-- RLS
ALTER TABLE group_chat_bestiary ENABLE ROW LEVEL SECURITY;

-- Group members can read the bestiary for their groups
CREATE POLICY "group_chat_bestiary_select"
  ON group_chat_bestiary FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_chat_bestiary.group_chat_id
        AND group_chat_members.user_id = auth.uid()
    )
  );

-- Only the group creator can insert/delete bestiary entries
CREATE POLICY "group_chat_bestiary_insert"
  ON group_chat_bestiary FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_bestiary.group_chat_id
        AND group_chats.creator_id = auth.uid()
    )
  );

CREATE POLICY "group_chat_bestiary_delete"
  ON group_chat_bestiary FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_bestiary.group_chat_id
        AND group_chats.creator_id = auth.uid()
    )
  );
