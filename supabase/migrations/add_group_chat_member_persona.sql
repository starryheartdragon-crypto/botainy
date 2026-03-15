ALTER TABLE public.group_chat_members
  ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_group_chat_members_persona_id
  ON public.group_chat_members(persona_id);
