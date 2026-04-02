-- Migration 001: extend budget_lines + add support_forms
-- Wklej w Supabase SQL Editor i uruchom

-- Dodaj kolumny do budget_lines
ALTER TABLE budget_lines
  ADD COLUMN IF NOT EXISTS sub_number text,
  ADD COLUMN IF NOT EXISTS contractor_name text,
  ADD COLUMN IF NOT EXISTS budget_type text DEFAULT 'dofinansowanie',
  ADD COLUMN IF NOT EXISTS participants_target int,
  ADD COLUMN IF NOT EXISTS hours_per_participant numeric,
  ADD COLUMN IF NOT EXISTS total_hours numeric,
  ADD COLUMN IF NOT EXISTS room_rate numeric,
  ADD COLUMN IF NOT EXISTS line_type text DEFAULT 'W';
-- line_type: W=wynagrodzenie, S=sala

-- Tabela form wsparcia (szablony sesji)
CREATE TABLE IF NOT EXISTS support_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id),
  code text NOT NULL,          -- np. "1.IPD | PnS | Psycholog | 2 | Educandis"
  name text NOT NULL,          -- np. "Psycholog - IPD"
  support_type text,           -- Psycholog / Doradztwo zawodowe / TSK / etc.
  meeting_type text,           -- Indywidualne / Grupowe 10 osób / Grupowe
  meetings_count int,          -- ile spotkań na uczestnika
  hours_per_meeting numeric,   -- ile godzin 1 spotkanie
  hour_type text,              -- zegarowe / dydaktyczne
  contractor_name text,
  rate_executor numeric,       -- stawka wykonawcy/h
  rate_room numeric,           -- stawka sali/h
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON support_forms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- support_form_budget_lines – powiązanie formy wsparcia z podzadaniami budżetowymi
CREATE TABLE IF NOT EXISTS support_form_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_form_id uuid REFERENCES support_forms(id) ON DELETE CASCADE,
  budget_line_id uuid REFERENCES budget_lines(id) ON DELETE CASCADE
);

ALTER TABLE support_form_budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON support_form_budget_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- events: dodaj support_form_id
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS support_form_id uuid REFERENCES support_forms(id);
