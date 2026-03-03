-- Create group_chats table for multi-user conversations
CREATE TABLE IF NOT EXISTS group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  background_url TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  max_members INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create group_chat_members table to track participation
CREATE TABLE IF NOT EXISTS group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_moderator BOOLEAN DEFAULT false,
  UNIQUE(group_chat_id, user_id)
);

-- Create group_chat_messages table for group conversations
CREATE TABLE IF NOT EXISTS group_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_group_chats_creator_id ON group_chats(creator_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_visibility ON group_chats(visibility);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_group_id ON group_chat_members(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user_id ON group_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_id ON group_chat_messages(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_created_at ON group_chat_messages(created_at);

-- Enable RLS on group_chats table
ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for group_chats
CREATE POLICY "Users can view public group chats" 
  ON group_chats FOR SELECT 
  USING (visibility = 'public' OR creator_id = auth.uid());

CREATE POLICY "Users can view private group chats they're a member of"
  ON group_chats FOR SELECT
  USING (
    visibility = 'private' AND EXISTS (
      SELECT 1 FROM group_chat_members 
      WHERE group_chat_members.group_chat_id = group_chats.id 
      AND group_chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create group chats"
  ON group_chats FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update their group chats"
  ON group_chats FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can delete their group chats"
  ON group_chats FOR DELETE
  USING (creator_id = auth.uid());

-- Policies for group_chat_members
CREATE POLICY "Users can view members of groups they're in"
  ON group_chat_members FOR SELECT
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM group_chat_members AS gcm
      WHERE gcm.group_chat_id = group_chat_members.group_chat_id
      AND gcm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join public groups"
  ON group_chat_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.visibility = 'public'
    )
  );

CREATE POLICY "Group creators can add members"
  ON group_chat_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove themselves from groups"
  ON group_chat_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Group creators can remove members"
  ON group_chat_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.creator_id = auth.uid()
    )
  );

-- Policies for group_chat_messages
CREATE POLICY "Members can view messages in their groups"
  ON group_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_chat_messages.group_chat_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages to their groups"
  ON group_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_chat_messages.group_chat_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own messages"
  ON group_chat_messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON group_chat_messages FOR DELETE
  USING (sender_id = auth.uid());
