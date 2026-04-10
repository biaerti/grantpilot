-- migration_011_invoices.sql
-- Rozbudowa tabeli expenses o pola fakturowe + bucket wnp-documents

-- 1. Dodaj kolumny do expenses
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS doc_type       TEXT DEFAULT 'faktura'
    CHECK (doc_type IN ('faktura', 'lista_plac', 'umowa_zlecenie', 'umowa_o_dzielo', 'rachunek', 'inne')),
  ADD COLUMN IF NOT EXISTS settlement_period_id UUID REFERENCES settlement_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_url        TEXT,
  ADD COLUMN IF NOT EXISTS file_name       TEXT,
  ADD COLUMN IF NOT EXISTS file_size       BIGINT,
  ADD COLUMN IF NOT EXISTS contractor_id   UUID REFERENCES contractors(id) ON DELETE SET NULL;

-- Indeks do filtrowania po WNP
CREATE INDEX IF NOT EXISTS idx_expenses_settlement_period ON expenses(settlement_period_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_date ON expenses(payment_date);

-- 2. Typ wniosku + plik PDF w settlement_periods
ALTER TABLE settlement_periods
  ADD COLUMN IF NOT EXISTS wnp_type TEXT DEFAULT 'rozliczeniowy'
    CHECK (wnp_type IN ('zaliczkowy', 'rozliczeniowy', 'sprawozdawczy')),
  ADD COLUMN IF NOT EXISTS file_url  TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 3. Bucket wnp-documents – utwórz ręcznie w Supabase:
-- Storage → New bucket → Name: "wnp-documents", Public: false
-- Polisy dodaj przez Storage → Policies:
--   INSERT: auth.role() = 'authenticated'
--   SELECT: auth.role() = 'authenticated'
--   DELETE: auth.role() = 'authenticated'
