CREATE TABLE IF NOT EXISTS user_music_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_playlist_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  track_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_music_tracks_user ON user_music_tracks(user_id, created_at);

ALTER TABLE user_music_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_music_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own music settings"
  ON user_music_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own music settings"
  ON user_music_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own music tracks"
  ON user_music_tracks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own music tracks"
  ON user_music_tracks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
