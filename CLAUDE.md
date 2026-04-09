@AGENTS.md

# GrantPilot – apka-do-projektow-ue

Next.js 16, TypeScript, shadcn/ui, Supabase PostgreSQL + Storage.
Repo: https://github.com/biaerti/grantpilot (branch: main)

## Projekty w aplikacji
1. **Postaw na Siebie** – FEDS.07.05-IP.02-0172/24 | project_id: `27721fc6-935a-46a3-863b-b485bc0db01c`
2. **Równość na co dzień** – FEDS.07.03-IP.02-0039/25 | project_id: `dda07567-a36f-488b-bab3-0790a89652a3`

---

## Zrealizowane funkcje (stan na 09.04.2026)

### Moduły / strony
| Ścieżka | Co robi |
|---|---|
| `/` | Dashboard |
| `/projects` | Lista projektów |
| `/projects/[id]` | Projekt detail + quick nav (kafelki) + zakładki (Zadania / Zdarzenia / Uczestnicy / WNP) |
| `/projects/[id]/tasks` | Zadania z podzadaniami budżetowymi, wydatki proporcjonalne, umowy jako sub-rows, expandable |
| `/projects/[id]/events` | Lista zdarzeń: filtr statusu / uczestnika / sali / tekst; edycja inline (dialog); usuwanie |
| `/projects/[id]/events/new` | Formularz: zadanie→podzadanie→forma wsparcia→wykonawca→umowa; daty, sala, uczestnicy multi-select; prefill z `?participant_id=` |
| `/projects/[id]/participants` | Tabela uczestników + import CSV SL + dialog wsparcia + kolumna Dokumenty (licznik + dialog upload/podgląd) |
| `/projects/[id]/contractors` | CRUD wykonawców, inline edit |
| `/projects/[id]/contracts` | CRUD umów, inline edit, auto-open edit przez `?edit=<id>` |
| `/projects/[id]/settlement` | Filtr miesiąc + umowa, summary, "Rozlicz wszystkie", "Generuj protokół odbioru" (.txt) |
| `/projects/[id]/documents` | Dokumenty uczestników: upload PDF/DOC/JPG, typy dokumentów, filtrowanie, grupowanie po uczestnikach, checklistka wymaganych |
| `/projects/[id]/wnp` | Okresy rozliczeniowe (wnioski o płatność) |
| `/projects/[id]/leads` | Leady rekrutacyjne: tabela kandydatów, statusy (nowy→uczestnik), dokumenty rekrutacyjne (checklistka), obdzwonka/przypomnienia, wysyłka maila z dokumentami |
| `/reminders` | Globalne przypomnienia obdzwonki: lista po dniach, zaległe/dzisiaj, filtr inicjały, zmiana przypisania |
| `/accounting` | Agregator zleceń księgowych wszystkich projektów (widok Kamili) |
| `/calendar` | Kalendarz zdarzeń + przypomnienia obdzwonki (żółte, toggle w legendzie) |

### Techniczne patterny — WAŻNE
- `React.Fragment key={id}` dla multiple `<tr>` w `.map()`
- Supabase joined queries → rzutować `as unknown as Type[]`
- shadcn Select `onValueChange` → `v ?? "default"` (może zwrócić null)
- Proporcjonalne rozkładanie wydatków task-level na budget_lines (gdy brak direct `budget_line_id`)
- Event form: "Dodaj umowę" otwiera w nowej karcie (`target="_blank"`), przycisk Odśwież ładuje aktywne umowy
- Kolumna projects: `project_number` (nie `number`)

---

## Schemat bazy danych

### Migracje (uruchamiać w Supabase SQL Editor w kolejności)
| Plik | Co dodaje |
|---|---|
| `supabase/schema.sql` | Pełny schemat bazowy |
| `supabase/migration_001_budget_sublines.sql` | `budget_lines`: sub_number, line_type, hours; tabela `support_forms` |
| `supabase/migration_002_event_hours.sql` | `events`: planned_hours, executor_name |
| `supabase/migration_003_contractors_contracts.sql` | Tabele `contractors` + `contracts`; FK do events i budget_lines |
| `supabase/migration_004_participant_documents.sql` | Tabele `document_types` + `participant_documents` |
| `supabase/migration_005_leads_reminders.sql` | Kolumny rekrutacyjne w `participants` + tabele `recruitment_document_types`, `lead_documents`, `reminders` |

### Kluczowe tabele
- `projects` – kolumna: `project_number` (nie `number`)
- `budget_lines` – `sub_number` (np. "1.1", "4.5"), `line_type` (W=wynagrodzenie, S=sala)
- `events` – status: draft→planned→accepted→completed→settled
- `event_participants` – unique(event_id, participant_id)
- `participants` – `technical_id` = ID z SL; `degurba` (1=miasto, 2=podmiejski, 3=wiejski)
- `document_types` – per projekt; `required` = wymagany dokument
- `participant_documents` – pliki w Supabase Storage bucket: `participant-documents`

### Budget lines PnS (sub_number → rola)
| sub_number | Rola |
|---|---|
| 1.1 | Doradca zawodowy – IPD |
| 1.2 | Psycholog – IPD |
| 1.3 | Sale – IPD |
| 2.1 | Trenerzy – TSK |
| 4.1 / 4.2 | Psycholog – MID |
| 4.5 | Pomoc prawna – MID |
| 4.7 | Doradca zawodowy – MID |
| 5.1 | Szkolenia zawodowe |
| 6.1 | Stypendia stażowe |
| 8.1 | Mentoring |

---

## Skrypty

### `scripts/import-pns-events.mjs` — ZREALIZOWANY
Import zdarzeń z CSV SL2014 → Supabase dla projektu PnS.

```bash
# Dry run (podgląd bez zapisu)
env $(cat .env.local | grep -v '^#' | xargs) node scripts/import-pns-events.mjs --dry-run

# Zapis do Supabase
env $(cat .env.local | grep -v '^#' | xargs) node scripts/import-pns-events.mjs
```

**Stan po uruchomieniu (08.04.2026):**
- 72 zdarzenia w bazie (psycholog, doradca, szkolenia, staże, warsztaty, pomoc prawna)
- 140+ event_participants przypisanych
- Plik CSV: `Uczestnicy-projektow/PnS_Uczestnicy_projektu_Efs_2026-04-01.csv` (w .gitignore – dane osobowe)

**Mapowanie wsparcia → budget_line (sub_number):**
| Rodzaj wsparcia | w tym | sub_number |
|---|---|---|
| doradztwo/konsultacje | pomoc psychologiczna | 1.2 / 4.1 / 4.2 |
| doradztwo/konsultacje | doradztwo zawodowe | 1.1 / 4.7 |
| doradztwo/konsultacje | doradztwo/ pomoc prawna | 4.5 |
| krajowe szkolenie/kurs | (brak) | 5.1 |
| usługa aktywnej integracji | o charakterze zawodowym | 6.1 |
| usługa aktywnej integracji | o charakterze społecznym | 8.1 |

---

## Dane wrażliwe — .gitignore
Foldery NIE commitowane (dane osobowe PESEL, imiona uczestników):
- `Uczestnicy-projektow/` — CSV z SL
- `Wnioski rozliczeniowe/` — PDF wniosków o płatność
- `csv-z-airtable/` — eksporty Airtable

---

## Do zrobienia (następne kroki)

### Priorytetowe
1. **Supabase Storage bucket** — stworzyć bucket `participant-documents` (Storage → New bucket, Public: true) żeby upload dokumentów działał
2. **Typy dokumentów PnS** — po uruchomieniu migration_004, wstawić przez SQL lub UI:
   - Formularz rekrutacyjny (wymagany)
   - Deklaracja uczestnictwa (wymagany)
   - Zgody RODO – 3 zgody (wymagany)
   - Pretest / Posttest
   - Zaświadczenie o zatrudnieniu
3. **Oznaczenie zdarzeń z WNP005 jako rozliczone** — WNP005 obejmuje 01.12.2025–31.01.2026; zdarzenia z tego okresu są w bazie jako `planned`, Kamila oznacza ręcznie w `/settlement`

### Do rozważenia
- `scripts/import-pns-wnp005-expenses.mjs` — import wydatków z zestawienia.txt WNP005 → tabela `expenses`
- Widok kalendarza z rozliczeniem sal per miesiąc
- Widok zdarzeń per uczestnik w tabeli uczestników (kolumna "Zdarzenia")

---

## Pliki kluczowe
```
src/
├── app/projects/[id]/
│   ├── page.tsx                    ← projekt detail + quick nav (kafelki) + zakładki
│   ├── tasks/page.tsx              ← zadania + podzadania + umowy sub-rows
│   ├── events/page.tsx             ← lista zdarzeń + filtry + edycja inline
│   ├── events/new/page.tsx         ← formularz nowego zdarzenia
│   ├── participants/page.tsx       ← uczestnicy + dokumenty (kolumna + dialog)
│   ├── contractors/page.tsx        ← wykonawcy CRUD
│   ├── contracts/page.tsx          ← umowy CRUD + edit
│   ├── settlement/page.tsx         ← rozliczenie miesięczne
│   ├── documents/page.tsx          ← dokumenty uczestników (cała zakładka)
│   └── wnp/page.tsx                ← okresy rozliczeniowe
├── components/layout/
│   ├── sidebar.tsx
│   └── header.tsx
├── lib/
│   ├── types.ts                    ← wszystkie typy (+ DocumentType, ParticipantDocument)
│   └── utils.ts
supabase/
├── schema.sql
├── migration_001_budget_sublines.sql
├── migration_002_event_hours.sql
├── migration_003_contractors_contracts.sql
└── migration_004_participant_documents.sql
scripts/
└── import-pns-events.mjs           ← import CSV SL → events + event_participants
```
