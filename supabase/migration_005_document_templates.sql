-- Migration 005: Szablony dokumentów z kategoriami i zmiennymi
-- Wklej w Supabase SQL Editor i uruchom

-- Rozszerzenie tabeli document_types
ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'inne',
  -- Możliwe wartości: deklaracja | formularz_online | formularz_papierowy | rodo | pretest | posttest | certyfikat | inne
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_line_id uuid REFERENCES budget_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '[]'::jsonb;
  -- np. [{"key": "first_name", "label": "Imię"}, {"key": "last_name", "label": "Nazwisko"}]

-- Rozszerzenie participant_documents o przypisanie do zadania/podzadania
ALTER TABLE participant_documents
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_line_id uuid REFERENCES budget_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated boolean DEFAULT false,
  -- generated = true oznacza że dokument wygenerowany z szablonu (nie ręcznie uploadowany)
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES document_types(id) ON DELETE SET NULL;
  -- skąd pochodzi (z jakiego szablonu wygenerowany)
