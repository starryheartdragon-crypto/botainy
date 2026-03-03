-- Chat Rooms support tables (separate from group_chats)
CREATE TABLE IF NOT EXISTS chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room_id ON chat_room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_created_at ON chat_room_messages(created_at);

ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view room memberships"
  ON chat_room_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM chat_room_members m
    WHERE m.room_id = chat_room_members.room_id
      AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can join rooms"
  ON chat_room_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave rooms"
  ON chat_room_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Members can view room messages"
  ON chat_room_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_room_members m
    WHERE m.room_id = chat_room_messages.room_id
      AND m.user_id = auth.uid()
  ));

CREATE POLICY "Members can send room messages"
  ON chat_room_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM chat_room_members m
      WHERE m.room_id = chat_room_messages.room_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own room messages"
  ON chat_room_messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own room messages"
  ON chat_room_messages FOR DELETE
  USING (sender_id = auth.uid());
