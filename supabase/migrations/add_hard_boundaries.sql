-- Add hard_boundaries column to users table.
-- Stores an array of content-category keys the user wants blocked (e.g. 'sa', 'noncon').
-- Defaults to an empty array (no boundaries set).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hard_boundaries text[] NOT NULL DEFAULT '{}';
