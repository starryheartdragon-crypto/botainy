CREATE TABLE IF NOT EXISTS bot_universe_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_name TEXT NOT NULL,
  request_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_universe_requests_requester
  ON bot_universe_requests (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_universe_requests_status
  ON bot_universe_requests (status, created_at DESC);

ALTER TABLE bot_universe_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit universe requests"
  ON bot_universe_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view own universe requests"
  ON bot_universe_requests FOR SELECT
  USING (auth.uid() = requester_id);

CREATE POLICY "Admins can view all universe requests"
  ON bot_universe_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
        AND u.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update universe requests"
  ON bot_universe_requests FOR UPDATE
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
