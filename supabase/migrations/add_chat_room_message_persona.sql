ALTER TABLE chat_room_messages
ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_room_messages_persona_id
ON chat_room_messages(persona_id);