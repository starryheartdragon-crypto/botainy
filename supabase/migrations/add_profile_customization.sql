-- Add new profile customization columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pronouns TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS interest_tags TEXT[] NOT NULL DEFAULT '{}';

-- Add new privacy toggles and section_order to profile_privacy_settings
ALTER TABLE profile_privacy_settings
  ADD COLUMN IF NOT EXISTS show_pronouns BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_location BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_tags BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_order TEXT[] NOT NULL DEFAULT ARRAY['bio', 'tags', 'music', 'bots', 'personas', 'guestbook'];
