-- Migration 008: Protokoły odbioru + numer umowy
-- Wklej w Supabase SQL Editor i uruchom

-- Dodaj numer umowy do contracts (np. "ZL/001/2026")
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_number text;

-- Tabela protokołów odbioru (generowanych per umowa per miesiąc)
CREATE TABLE IF NOT EXISTS protocols (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id        uuid REFERENCES contracts(id) ON DELETE SET NULL,
  contractor_id      uuid REFERENCES contractors(id) ON DELETE SET NULL,
  task_id            uuid REFERENCES tasks(id) ON DELETE SET NULL,
  template_id        uuid REFERENCES document_types(id) ON DELETE SET NULL,

  month              text NOT NULL,           -- 'YYYY-MM', np. '2026-04'
  total_hours        numeric DEFAULT 0,
  total_participants int DEFAULT 0,
  total_amount       numeric DEFAULT 0,
  event_count        int DEFAULT 0,

  content_summary    text,                    -- auto-generated Polish summary
  event_ids          uuid[] DEFAULT '{}',     -- snapshot which events were used

  document_url       text,                    -- URL wygenerowanego DOCX w Storage
  status             text NOT NULL DEFAULT 'draft',  -- draft | generated | sent

  created_at         timestamptz DEFAULT now()
);

ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON protocols
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS protocols_project_id_idx ON protocols(project_id);
CREATE INDEX IF NOT EXISTS protocols_contract_id_idx ON protocols(contract_id);
CREATE INDEX IF NOT EXISTS protocols_month_idx ON protocols(project_id, month);
