-- ============================================================
-- BADGES & LEADERBOARDS
-- ============================================================

-- Badge categories enum
CREATE TYPE badge_category AS ENUM (
  'elite_storytelling',
  'community_pillars',
  'silly_flavor',
  'infamous_spicy',
  'event'
);

-- Master badge catalog (admin-managed)
CREATE TABLE IF NOT EXISTS badges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,           -- e.g. "chaos_gremlin"
  name          TEXT NOT NULL,                  -- e.g. "Chaos Gremlin"
  description   TEXT NOT NULL,
  category      badge_category NOT NULL,
  icon_url      TEXT,                           -- optional custom icon
  is_event      BOOLEAN NOT NULL DEFAULT FALSE,
  event_id      UUID,                           -- FK to badge_events, nullable
  reputation_points INT NOT NULL DEFAULT 1,     -- base = 1, event badges can be 5
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,  -- false = retired/vault
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event windows for seasonal/event badges
CREATE TABLE IF NOT EXISTS badge_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                  -- e.g. "Spring Equinox 2026"
  description   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK from badges → badge_events
ALTER TABLE badges
  ADD CONSTRAINT fk_badges_event
  FOREIGN KEY (event_id) REFERENCES badge_events(id) ON DELETE SET NULL;

-- User badge inventory: instances of badges a user has earned/been awarded
-- Each row is one "copy" of a badge that can be gifted once
CREATE TABLE IF NOT EXISTS user_badge_inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id      UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  gifted        BOOLEAN NOT NULL DEFAULT FALSE, -- true once this copy has been gifted away
  earned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ubi_user_id ON user_badge_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_ubi_badge_id ON user_badge_inventory(badge_id);

-- Badges received by users (the "received" ledger)
CREATE TABLE IF NOT EXISTS user_badges_received (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gifter_id     UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system award
  badge_id      UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  inventory_id  UUID REFERENCES user_badge_inventory(id) ON DELETE SET NULL, -- source inventory row
  message       TEXT,                           -- optional personal note with gift
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ubr_recipient_id ON user_badges_received(recipient_id);
CREATE INDEX IF NOT EXISTS idx_ubr_badge_id ON user_badges_received(badge_id);
CREATE INDEX IF NOT EXISTS idx_ubr_gifter_id ON user_badges_received(gifter_id);

-- Pinned badges: up to 3 badges a user pins to their profile card
CREATE TABLE IF NOT EXISTS user_pinned_badges (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  received_id   UUID NOT NULL REFERENCES user_badges_received(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  PRIMARY KEY (user_id, position),
  UNIQUE (user_id, received_id)
);

-- ============================================================
-- REPUTATION & LEADERBOARD
-- ============================================================

-- Per-user rolling reputation totals (updated by cron / trigger)
CREATE TABLE IF NOT EXISTS user_reputation (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  all_time      INT NOT NULL DEFAULT 0,
  monthly       INT NOT NULL DEFAULT 0,         -- reset each month by cron
  monthly_year  INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  monthly_month INT NOT NULL DEFAULT EXTRACT(MONTH FROM NOW())::INT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leaderboard snapshot cache (populated every 24 h by cron endpoint)
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_type    TEXT NOT NULL,                  -- 'all_time' | 'monthly' | 'badge:{slug}'
  rank          INT NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INT NOT NULL,
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lb_type_rank ON leaderboard_snapshots(board_type, rank);

-- ============================================================
-- REPUTATION EVENTS (audit trail for score changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS reputation_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,                  -- 'badge_received','bot_created','message_sent','login_streak','chat_room_joined'
  points        INT NOT NULL,
  ref_id        UUID,                           -- optional FK to the triggering row
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_user_id ON reputation_events(user_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- badges: public read, only service role writes
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_public_read" ON badges FOR SELECT USING (true);

-- badge_events: public read
ALTER TABLE badge_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badge_events_public_read" ON badge_events FOR SELECT USING (true);

-- user_badge_inventory: owner read only
ALTER TABLE user_badge_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ubi_owner_read" ON user_badge_inventory FOR SELECT USING (auth.uid() = user_id);

-- user_badges_received: owner + gifter read; public profile read handled via API
ALTER TABLE user_badges_received ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ubr_recipient_read" ON user_badges_received FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "ubr_gifter_read"    ON user_badges_received FOR SELECT USING (auth.uid() = gifter_id);

-- user_pinned_badges: public read (for profile cards), owner write
ALTER TABLE user_pinned_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upb_public_read"   ON user_pinned_badges FOR SELECT USING (true);
CREATE POLICY "upb_owner_insert"  ON user_pinned_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upb_owner_update"  ON user_pinned_badges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "upb_owner_delete"  ON user_pinned_badges FOR DELETE USING (auth.uid() = user_id);

-- user_reputation: public read
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_public_read" ON user_reputation FOR SELECT USING (true);

-- leaderboard_snapshots: public read
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lb_public_read" ON leaderboard_snapshots FOR SELECT USING (true);

-- reputation_events: owner read
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "re_owner_read" ON reputation_events FOR SELECT USING (auth.uid() = user_id);
