-- Per-persona relationship context for individual chat sessions.
-- One row per (chat_id, persona_id) pair.
-- When persona_id IS NULL the row holds the "no persona" (profile) context.

CREATE TABLE IF NOT EXISTS chat_persona_relationships (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id              UUID         NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  -- NULL means the user is chatting as their own profile (no persona selected)
  persona_id           UUID         REFERENCES personas(id) ON DELETE CASCADE,
  relationship_context TEXT         NOT NULL DEFAULT '',
  relationship_score   INTEGER      NOT NULL DEFAULT 0
    CHECK (relationship_score >= -100 AND relationship_score <= 100),
  relationship_tags    TEXT[]       NOT NULL DEFAULT '{}',
  relationship_events  JSONB        NOT NULL DEFAULT '[]',
  relationship_summary TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, persona_id)
);

-- Index for fast lookups by chat + persona
CREATE INDEX IF NOT EXISTS idx_chat_persona_relationships_chat_persona
  ON chat_persona_relationships (chat_id, persona_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_chat_persona_relationships_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_persona_relationships_updated_at ON chat_persona_relationships;
CREATE TRIGGER trg_chat_persona_relationships_updated_at
  BEFORE UPDATE ON chat_persona_relationships
  FOR EACH ROW EXECUTE FUNCTION update_chat_persona_relationships_updated_at();

-- RLS: only the owner of the chat can read/write their relationship rows
ALTER TABLE chat_persona_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_chat_persona_relationships"
  ON chat_persona_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_persona_relationships.chat_id
        AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_chat_persona_relationships"
  ON chat_persona_relationships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_persona_relationships.chat_id
        AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_update_chat_persona_relationships"
  ON chat_persona_relationships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_persona_relationships.chat_id
        AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_delete_chat_persona_relationships"
  ON chat_persona_relationships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_persona_relationships.chat_id
        AND chats.user_id = auth.uid()
    )
  );
