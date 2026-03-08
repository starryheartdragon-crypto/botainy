ALTER TABLE public.group_chats
  ADD COLUMN IF NOT EXISTS persona_relationship_context TEXT;
