-- Bot-defined relationship system configuration.
-- Each bot can define up to 3 relationship tracks with custom stages, thresholds, and milestones.

CREATE TABLE IF NOT EXISTS bot_relationship_config (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id      UUID        NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  -- JSON array of up to 3 track objects:
  -- { name: string, arc_preset: string|null, stages: [{min,max,label,color}], thresholds: [{score,instruction}] }
  tracks      JSONB       NOT NULL DEFAULT '[]',
  -- JSON array of milestone objects defined by the creator:
  -- { score: number, track_index: number, name: string, description: string }
  milestones  JSONB       NOT NULL DEFAULT '[]',
  -- How many bot replies between AI batch score analyses (3, 5, or 10)
  batch_every INTEGER     NOT NULL DEFAULT 5 CHECK (batch_every IN (3, 5, 10)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id)
);

CREATE OR REPLACE FUNCTION update_bot_relationship_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_relationship_config_updated_at ON bot_relationship_config;
CREATE TRIGGER trg_bot_relationship_config_updated_at
  BEFORE UPDATE ON bot_relationship_config
  FOR EACH ROW EXECUTE FUNCTION update_bot_relationship_config_updated_at();

ALTER TABLE bot_relationship_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read a bot's relationship config (needed to render the chat panel)
CREATE POLICY "public_read_bot_relationship_config"
  ON bot_relationship_config FOR SELECT
  USING (true);

-- Only the bot creator can write
CREATE POLICY "creator_write_bot_relationship_config"
  ON bot_relationship_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_relationship_config.bot_id AND bots.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_relationship_config.bot_id AND bots.creator_id = auth.uid()
    )
  );
