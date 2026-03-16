-- Create chat_rooms table with all required columns
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  background_url TEXT,
  city_info TEXT,
  notable_bots TEXT,
  universe TEXT,
  era TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_at ON chat_rooms(created_at);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat rooms"
  ON chat_rooms FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage chat rooms"
  ON chat_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.is_admin = TRUE
    )
  );
