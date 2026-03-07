-- Allow group_chat_messages.sender_id to store bot identifiers (non-auth UUID/text)
-- This enables persisted bot replies in group chats.
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
