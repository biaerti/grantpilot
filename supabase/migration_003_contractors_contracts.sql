-- Migration 003: Wykonawcy (contractors) + Umowy (contracts)
-- Wklej w Supabase SQL Editor i uruchom

-- Tabela wykonawców
CREATE TABLE IF NOT EXISTS contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  nip text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON contractors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela umów
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES contractors(id),
  task_id uuid REFERENCES tasks(id),
  budget_line_id uuid REFERENCES budget_lines(id),
  name text NOT NULL,
  scope text,
  amount numeric,
  date_from date,
  date_to date,
  status text DEFAULT 'draft', -- draft, active, completed
  document_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Dodaj contractor_id do budget_lines (powiązanie realizatora z podzadaniem)
ALTER TABLE budget_lines ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES contractors(id);

-- Dodaj contract_id do events (do której umowy należy zdarzenie)
ALTER TABLE events ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id);
