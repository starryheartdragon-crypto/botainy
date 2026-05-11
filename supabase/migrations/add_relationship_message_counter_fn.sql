-- RPC helper: safely increment messages_since_analysis on a relationship row.
-- Called after each bot reply. If no row exists yet, it will be created on next upsert.

CREATE OR REPLACE FUNCTION increment_relationship_message_counter(
  p_chat_id  UUID,
  p_persona_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE chat_persona_relationships
  SET messages_since_analysis = messages_since_analysis + 1,
      updated_at = NOW()
  WHERE chat_id = p_chat_id
    AND persona_id = p_persona_id;
END;
$$;
