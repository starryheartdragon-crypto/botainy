-- Backfill for environments where reports table was created before details existed.
alter table if exists public.reports
  add column if not exists details text;
