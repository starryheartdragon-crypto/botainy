CREATE TABLE IF NOT EXISTS chat_room_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_name TEXT NOT NULL,
  request_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_room_requests_requester
  ON chat_room_requests (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_room_requests_status
  ON chat_room_requests (status, created_at DESC);

ALTER TABLE chat_room_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit chat room requests"
  ON chat_room_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view own chat room requests"
  ON chat_room_requests FOR SELECT
  USING (auth.uid() = requester_id);

CREATE POLICY "Admins can view all chat room requests"
  ON chat_room_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update chat room requests"
  ON chat_room_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.is_admin = TRUE
    )
  );
