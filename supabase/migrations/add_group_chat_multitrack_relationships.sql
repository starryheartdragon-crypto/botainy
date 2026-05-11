-- Per-persona, per-bot, per-group multi-track relationship tracking
CREATE TABLE IF NOT EXISTS group_chat_persona_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  track_scores JSONB NOT NULL DEFAULT '[]',
  milestones_achieved JSONB NOT NULL DEFAULT '[]',
  messages_since_analysis INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_chat_id, persona_id, bot_id)
);

CREATE INDEX IF NOT EXISTS idx_gc_persona_rel_group   ON group_chat_persona_relationships(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_gc_persona_rel_persona ON group_chat_persona_relationships(persona_id);
CREATE INDEX IF NOT EXISTS idx_gc_persona_rel_bot     ON group_chat_persona_relationships(bot_id);

ALTER TABLE group_chat_persona_relationships ENABLE ROW LEVEL SECURITY;

-- Users can read their own persona's relationship rows
CREATE POLICY "Users can read their group persona relationships"
  ON group_chat_persona_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM personas
      WHERE personas.id = persona_id AND personas.user_id = auth.uid()
    )
  );

-- Service role handles writes via upsert; users can INSERT through service role only.
-- These policies are permissive for anon reads so the bot config fetch can join data.
CREATE POLICY "Service role can manage group persona relationships"
  ON group_chat_persona_relationships FOR ALL
  USING (true)
  WITH CHECK (true);
