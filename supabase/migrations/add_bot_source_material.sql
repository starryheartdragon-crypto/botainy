-- Add source material fields to bots table for character voice reference
ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS source_excerpts text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS example_dialogues jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS character_quotes text[] DEFAULT NULL;

COMMENT ON COLUMN bots.source_excerpts IS 'Pasted excerpts from scripts, books, or media showing the character voice (max ~5000 chars)';
COMMENT ON COLUMN bots.example_dialogues IS 'Array of {user, bot} example conversation pairs for few-shot prompting';
COMMENT ON COLUMN bots.character_quotes IS 'Array of iconic quotes from the character showing their speech style';
