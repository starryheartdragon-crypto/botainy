CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE user_connections
  ADD CONSTRAINT user_connections_not_self CHECK (requester_id <> addressee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_connections_unique_pair
  ON user_connections (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_user_connections_requester
  ON user_connections (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_user_connections_addressee
  ON user_connections (addressee_id, status);

ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections"
  ON user_connections FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create requests as requester"
  ON user_connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requester can update/cancel own requests"
  ON user_connections FOR UPDATE
  USING (auth.uid() = requester_id);

CREATE POLICY "Addressee can respond to requests"
  ON user_connections FOR UPDATE
  USING (auth.uid() = addressee_id);

CREATE POLICY "Participants can delete their connection"
  ON user_connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
