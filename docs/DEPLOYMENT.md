# GrantPilot – Deployment Guide

## Stack

| Warstwa | Serwis |
|---|---|
| Frontend / API routes | Next.js 16 na **Vercel** |
| Baza danych | **Supabase** PostgreSQL |
| Storage (pliki) | **Supabase Storage** |
| Email | **Resend** (`projekty@grantpilot.pl`) |
| Formularze | **Tally** (webhook → `/api/leads/tally-sync`) |

---

## Repo i CI/CD

- Repo: https://github.com/biaerti/grantpilot (branch: `main`)
- Vercel autopublishuje przy każdym pushu do `main`
- Dashboard Vercel: https://vercel.com/biaertis-projects/grantpilot
- Live URL: https://grantpilot.vercel.app (lub przypisana domena)

**Żeby wdrożyć nową wersję:**
```bash
git add <pliki>
git commit -m "feat: opis zmian"
git push origin main
# → Vercel automatycznie deployuje w ~1-2 min
```

---

## Zmienne środowiskowe (Vercel → Settings → Environment Variables)

| Zmienna | Opis |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Klucz anonimowy Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (tylko server-side, NIE `NEXT_PUBLIC_`) |
| `RESEND_API_KEY` | Klucz API Resend |
| `RESEND_FROM` | Adres nadawcy email (`projekty@grantpilot.pl`) |
| `NEXT_PUBLIC_APP_URL` | Pełny URL aplikacji (np. `https://grantpilot.vercel.app`) |
| `TALLY_API_KEY` | Klucz API Tally do pobierania odpowiedzi |
| `TALLY_WEBHOOK_SECRET` | Secret do weryfikacji webhooków Tally (opcjonalnie) |

> Wartości są w pliku `.env.local` (lokalnie) – **nie commitować do repo**.

---

## Supabase – migracje bazy danych

Migracje uruchamiać ręcznie w kolejności przez:
**Supabase Dashboard → SQL Editor → New query → wklej SQL → Run**

| Plik | Status |
|---|---|
| `supabase/schema.sql` | Pełny schemat bazowy |
| `supabase/migration_001_budget_sublines.sql` | `budget_lines`: sub_number, line_type, hours; tabela `support_forms` |
| `supabase/migration_002_event_hours.sql` | `events`: planned_hours, executor_name |
| `supabase/migration_003_contractors_contracts.sql` | Tabele `contractors` + `contracts` |
| `supabase/migration_004_participant_documents.sql` | Tabele `document_types` + `participant_documents` |
| `supabase/migration_005_leads_reminders.sql` | Kolumny rekrutacyjne w `participants` + `lead_documents`, `reminders` |
| `supabase/migration_005_document_templates.sql` | Szablony dokumentów |
| `supabase/migration_006_indicators.sql` | Wskaźniki projektów |
| `supabase/migration_006b_pns_indicators.sql` | Wskaźniki PnS |
| `supabase/migration_007_participant_status_indicators.sql` | Status uczestnika a wskaźniki |
| `supabase/migration_008_protocols.sql` | Tabela protokołów odbioru |
| `supabase/migration_010_fix_recruitment_doc_types.sql` | Fix typów dokumentów rekrutacyjnych |
| `supabase/migration_011_invoices.sql` | Faktury/dokumenty kosztowe + typ WNP + plik PDF w WNP |

### Szybki status – sprawdź czy migracja już była:
```sql
-- Czy kolumna doc_type istnieje w expenses?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'doc_type';

-- Czy kolumna wnp_type istnieje w settlement_periods?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'settlement_periods' AND column_name = 'wnp_type';
```

---

## Supabase Storage – buckety

| Bucket | Zawartość | Publiczny |
|---|---|---|
| `participant-documents` | Dokumenty uczestników (PDF, JPG) | tak |
| `wnp-documents` | Faktury, PDFy WNP | nie |

### Jak stworzyć bucket:
Supabase Dashboard → Storage → New bucket → podaj nazwę → wybierz publiczny/prywatny

### Polisy dla `wnp-documents` (dodaj przez Storage → Policies):
```sql
-- SELECT (pobieranie)
(auth.role() = 'authenticated')

-- INSERT (upload)
(auth.role() = 'authenticated')

-- DELETE
(auth.role() = 'authenticated')
```

---

## Lokalny development

```bash
# Instalacja
npm install

# Plik ze zmiennymi środowiskowymi (skopiuj i uzupełnij)
cp .env.local.example .env.local

# Start dev
npm run dev
# → http://localhost:3000

# Sprawdzenie typów
npx tsc --noEmit

# Build produkcyjny (test przed deployem)
npm run build
```

---

## Tally Webhook

URL webhooka do ustawienia w panelu Tally:
```
https://<twoja-domena>/api/leads/tally-sync
```

Tally Dashboard → Formularz → Integrations → Webhook → wklej URL → Save

---

## Rollback

W razie problemów po deploymencie:
1. Vercel Dashboard → Deployments → wybierz poprzedni deployment → "..." → **Promote to Production**
2. Migracji SQL **nie** można automatycznie rollbackować – przed każdą migrację warto zrobić backup przez Supabase Dashboard → Database → Backups
