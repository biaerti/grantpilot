-- Migration 004: Dokumenty uczestników
-- Wklej w Supabase SQL Editor i uruchom

-- Tabela typów dokumentów (szablony dokumentów per projekt)
CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,             -- np. "Formularz rekrutacyjny", "Deklaracja uczestnictwa", "Zgody RODO"
  description text,
  required boolean DEFAULT false, -- czy wymagany dla uczestnika
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON document_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela dokumentów uczestników
CREATE TABLE IF NOT EXISTS participant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES participants(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  document_type_id uuid REFERENCES document_types(id) ON DELETE SET NULL,
  name text NOT NULL,             -- np. "Formularz rekrutacyjny – Kowalski Jan"
  file_url text,                  -- ścieżka w Supabase Storage
  file_name text,                 -- oryginalna nazwa pliku
  file_size int,                  -- bajty
  mime_type text,                 -- application/pdf, application/msword, etc.
  notes text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE participant_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can do everything" ON participant_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index dla szybkiego pobierania dokumentów uczestnika
CREATE INDEX IF NOT EXISTS idx_participant_documents_participant ON participant_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_documents_project ON participant_documents(project_id);

-- Predefiniowane typy dokumentów dla nowych projektów możemy wstawić ręcznie po uruchomieniu
-- lub przez aplikację. Przykład dla projektu PnS:
-- INSERT INTO document_types (project_id, name, required, sort_order) VALUES
--   ('<project_id>', 'Formularz rekrutacyjny', true, 1),
--   ('<project_id>', 'Deklaracja uczestnictwa', true, 2),
--   ('<project_id>', 'Zgody RODO (3 zgody)', true, 3),
--   ('<project_id>', 'Pretest', false, 4),
--   ('<project_id>', 'Posttest', false, 5),
--   ('<project_id>', 'Zaświadczenie o zatrudnieniu', false, 6);
