-- Public profile features: privacy settings, follows, likes, guestbook comments

-- Per-field privacy toggles for public profiles
CREATE TABLE IF NOT EXISTS profile_privacy_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_bio BOOLEAN NOT NULL DEFAULT true,
  show_avatar BOOLEAN NOT NULL DEFAULT true,
  show_bots BOOLEAN NOT NULL DEFAULT true,
  show_music BOOLEAN NOT NULL DEFAULT true,
  show_connections_count BOOLEAN NOT NULL DEFAULT true,
  show_join_date BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profile_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own privacy settings"
  ON profile_privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings"
  ON profile_privacy_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings"
  ON profile_privacy_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Follow relationships (one-directional)
CREATE TABLE IF NOT EXISTS profile_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_follows_follower ON profile_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_profile_follows_following ON profile_follows(following_id);

ALTER TABLE profile_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
  ON profile_follows FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can follow"
  ON profile_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON profile_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Profile likes
CREATE TABLE IF NOT EXISTS profile_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, profile_user_id),
  CHECK (user_id <> profile_user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_likes_profile_user ON profile_likes(profile_user_id);

ALTER TABLE profile_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profile likes"
  ON profile_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like a profile"
  ON profile_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike a profile"
  ON profile_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Public guestbook comments on profiles
CREATE TABLE IF NOT EXISTS profile_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_comments_profile_user
  ON profile_comments(profile_user_id, created_at DESC);

ALTER TABLE profile_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profile comments"
  ON profile_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can post comments"
  ON profile_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own comments; profile owners can delete comments on their profile
CREATE POLICY "Authors and profile owners can delete comments"
  ON profile_comments FOR DELETE
  USING (auth.uid() = author_id OR auth.uid() = profile_user_id);
