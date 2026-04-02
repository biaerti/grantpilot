-- Migration 002: add planned_hours to events, executor_name to events
-- Wklej w Supabase SQL Editor i uruchom

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS planned_hours numeric,
  ADD COLUMN IF NOT EXISTS executor_name text;
