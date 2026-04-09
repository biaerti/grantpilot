-- Migration 006: Wskaźniki projektu
-- Wklej w Supabase SQL Editor i uruchom

CREATE TABLE IF NOT EXISTS project_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  code text,                    -- np. "O.1", "R.1" – kod z wniosku
  name text NOT NULL,           -- np. "Liczba osób objętych wsparciem"
  type text DEFAULT 'product',  -- 'product' (produkt) | 'result' (rezultat) | 'soft' (miękki)
  target_value numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'os.',      -- jednostka miary
  auto_field text,              -- jeśli obliczany z bazy: 'participants_total' | 'participants_female' |
                                -- 'participants_male' | 'participants_age_18_29' | 'participants_age_55' |
                                -- 'participants_rural' | 'participants_disabled' | 'participants_homeless' |
                                -- 'participants_minority' | 'events_count' | null (ręczny)
  current_value numeric DEFAULT 0,  -- wartość ręczna (gdy auto_field = null)
  notes text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON project_indicators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_project_indicators_project ON project_indicators(project_id);

-- Predefiniowane wskaźniki dla PnS (wstaw po uruchomieniu migracji)
-- Uzupełnij project_id i target_value na podstawie wniosku
-- INSERT INTO project_indicators (project_id, code, name, type, target_value, unit, auto_field, sort_order) VALUES
-- ('<PNS_PROJECT_ID>', 'O.1',  'Liczba osób zagrożonych ubóstwem lub wykluczeniem objętych wsparciem', 'product', 80,  'os.', 'participants_total',    1),
-- ('<PNS_PROJECT_ID>', 'O.2',  'Kobiety', 'product', 48, 'os.', 'participants_female', 2),
-- ('<PNS_PROJECT_ID>', 'O.3',  'Mężczyźni', 'product', 32, 'os.', 'participants_male', 3),
-- ('<PNS_PROJECT_ID>', 'O.4',  'Osoby w wieku 18–29 lat', 'product', 16, 'os.', 'participants_age_18_29', 4),
-- ('<PNS_PROJECT_ID>', 'O.5',  'Osoby 55+ lat', 'product', 0,  'os.', 'participants_age_55',   5),
-- ('<PNS_PROJECT_ID>', 'O.6',  'Osoby z obszarów wiejskich', 'product', 0, 'os.', 'participants_rural', 6),
-- ('<PNS_PROJECT_ID>', 'O.7',  'Osoby z niepełnosprawnościami', 'product', 0, 'os.', 'participants_disabled', 7),
-- ('<PNS_PROJECT_ID>', 'R.1',  'Liczba osób poszukujących pracy po opuszczeniu programu', 'result', 16, 'os.', null, 10),
-- ('<PNS_PROJECT_ID>', 'R.2',  'Liczba osób pracujących po opuszczeniu programu', 'result', 32, 'os.', null, 11);
