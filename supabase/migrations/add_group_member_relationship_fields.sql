-- Add per-member relationship fields to group_chat_members
-- This allows each member to have their own relationship score and context
-- relative to the group, which feeds into AI prompts per-sender.

ALTER TABLE public.group_chat_members
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relationship_context TEXT;

COMMENT ON COLUMN public.group_chat_members.relationship_score IS
  'Relationship score for this member (-100 to 100), used in AI system prompts';
COMMENT ON COLUMN public.group_chat_members.relationship_context IS
  'Free-text relationship/backstory context for this member in the group';
