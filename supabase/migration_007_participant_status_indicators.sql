-- Migration 007: Status uczestnictwa + wskaźniki per uczestnik
-- Wklej w Supabase SQL Editor i uruchom

-- 1. Kolumna participation_status w participants
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS participation_status text DEFAULT 'active'
    CHECK (participation_status IN ('lead', 'active', 'completed'));

-- 2. Tabela participant_indicators – zaznaczanie wskaźników rezultatu per uczestnik
CREATE TABLE IF NOT EXISTS participant_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  indicator_id uuid REFERENCES project_indicators(id) ON DELETE CASCADE NOT NULL,
  achieved boolean DEFAULT false,        -- true = osiągnięty (uczestnik zakończył i potwierdził)
  noted boolean DEFAULT false,           -- true = zanotowany (uczestnik jeszcze aktywny, ale zaznaczono)
  noted_at timestamptz,
  achieved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (participant_id, indicator_id)
);

ALTER TABLE participant_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON participant_indicators
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_participant_indicators_participant ON participant_indicators(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_indicators_indicator ON participant_indicators(indicator_id);
