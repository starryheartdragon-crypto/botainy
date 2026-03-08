-- Allow group_chat_messages.sender_id to store bot identifiers (non-auth UUID/text)
-- This enables persisted bot replies in group chats.

-- Drop policies that depend on sender_id before type conversion.
DROP POLICY IF EXISTS "Members can send messages to their groups" ON public.group_chat_messages;
DROP POLICY IF EXISTS "Users can edit their own messages" ON public.group_chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.group_chat_messages;

DO $$
DECLARE
  sender_type text;
  fk record;
BEGIN
  IF to_regclass('public.group_chat_messages') IS NULL THEN
    RETURN;
  END IF;

  SELECT data_type
  INTO sender_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'group_chat_messages'
    AND column_name = 'sender_id';

  IF sender_type IS NULL THEN
    RETURN;
  END IF;

  -- Drop foreign keys attached to group_chat_messages.sender_id (commonly auth.users FK)
  FOR fk IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname = 'group_chat_messages'
      AND a.attname = 'sender_id'
  LOOP
    EXECUTE format('ALTER TABLE public.group_chat_messages DROP CONSTRAINT IF EXISTS %I', fk.conname);
  END LOOP;

  -- Convert sender_id to text if still UUID
  IF sender_type = 'uuid' THEN
    ALTER TABLE public.group_chat_messages
      ALTER COLUMN sender_id TYPE text USING sender_id::text;
  END IF;
END
$$;

-- Recreate policies with text-safe sender checks.
CREATE POLICY "Members can send messages to their groups"
  ON public.group_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()::text AND EXISTS (
      SELECT 1
      FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_chat_messages.group_chat_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can edit their own messages"
  ON public.group_chat_messages FOR UPDATE
  USING (sender_id = auth.uid()::text);

CREATE POLICY "Users can delete their own messages"
  ON public.group_chat_messages FOR DELETE
  USING (sender_id = auth.uid()::text);
