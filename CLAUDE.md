@AGENTS.md

# GrantPilot – apka-do-projektow-ue

Next.js 14 App Router, TypeScript, shadcn/ui, Supabase PostgreSQL.

## Projekty w aplikacji
1. **Postaw na Siebie** – FEDS.07.05-IP.02-0172/24 (projekt ARS – aktywizacja zawodowa)
2. **Równość na co dzień** – FEDS.07.03-IP.02-0039/25 (projekt Fundacja Pretium)

---

## Zrealizowane funkcje (stan na 03.04.2026)

### Moduły
- Dashboard, Projekty, Kalendarz, Rozliczenia, Ustawienia
- Sidebar z listą projektów (expandable, zielona kropka = aktywny)
- Strona projektu: szybki nav (Zadania, Zdarzenia, Uczestnicy, Wykonawcy, Umowy, Rozliczenie)
- **Zadania** (`/tasks`) – tabela zadań z podzadaniami budżetowymi, wydatki proporcjonalne, umowy jako sub-rows, expandable
- **Zdarzenia** (`/events`) – lista z filtrem statusu, filtrem uczestnika, filtrem sali/lokalizacji, wyszukiwanie, edycja inline (dialog), usuwanie
- **Nowe zdarzenie** (`/events/new`) – formularz z: zadanie → podzadanie → forma wsparcia (filtrowana po podzadaniu) → wykonawca → umowa; daty start/end, sala (select ze stałej listy), uczestnicy multi-select, prefill z `?participant_id=`
- **Uczestnicy** (`/participants`) – tabela, `+ Wsparcie` → redirect do events/new?participant_id=
- **Wykonawcy** (`/contractors`) – CRUD, inline edit
- **Umowy** (`/contracts`) – CRUD, inline edit (ContractForm), auto-open edit przez `?edit=<id>` z URL
- **Rozliczenie** (`/settlement`) – filtr miesiąc + umowa, summary, "Rozlicz wszystkie", "Generuj protokół odbioru" (.txt)

### Techniczne
- `React.Fragment key={id}` dla multiple `<tr>` w `.map()`
- Supabase joined queries → `as unknown as Type[]`
- shadcn Select `onValueChange` → `v ?? "default"` (string | null)
- Proporcjonalne rozkładanie wydatków task-level na budget_lines (gdy brak direct budget_line_id)
- Event form: "Dodaj umowę" otwiera w nowej karcie (`target="_blank"`), przycisk Odśwież ładuje aktywne umowy bez przeładowania

---

## NASTĘPNY KROK – Import CSV SL → Zdarzenia (PRIORYTET)

### Co robimy
Plik: `Uczestnicy-projektow/PnS_Uczestnicy_projektu_Efs_2026-04-01.csv`
Cel: z danych SL wygenerować rekordy `events` + `event_participants` w Supabase dla projektu PnS.

### Struktura CSV (separator `;`)
Każdy uczestnik = 1 wiersz. Wsparcia pipe-separated (`|`):
- kol. `Rodzaj przyznanego wsparcia` → np. `doradztwo/konsultacje|krajowe szkolenie/kurs|usługa aktywnej integracji`
- kol. `w tym` → podtyp: `pomoc psychologiczna|doradztwo zawodowe||usługa o charakterze zawodowym`
- kol. `Data rozpoczęcia udziału we wsparciu` → daty: `2026-01-30|2026-01-30|2026-02-02|2026-01-16`

### Mapowanie wsparcia → podzadania (PnS)
| Rodzaj | w tym | Podzadanie |
|---|---|---|
| doradztwo/konsultacje | pomoc psychologiczna | psycholog (Zad.1) |
| doradztwo/konsultacje | doradztwo zawodowe | doradca zawodowy (Zad.1) |
| krajowe szkolenie/kurs | (brak) | szkolenie zawodowe (Zad.2) |
| usługa aktywnej integracji | usługa o charakterze zawodowym | staż/praktyki (Zad.3) |
| usługa aktywnej integracji | usługa o charakterze społecznym | warsztaty społ. (Zad.4) |

### Plan techniczny
1. Skrypt `scripts/import-pns-events.mjs` (Node.js, czyta CSV, insert do Supabase)
2. Dla każdego uczestnika × każde wsparcie (pipe-item):
   - znajdź lub utwórz `event` (group by: data + typ wsparcia → jeden event per dzień per typ)
   - insert `event_participants` łączący uczestnika z eventem
3. Zmapować `budget_line_id` przez zapytanie do Supabase po nazwie/typie podzadania
4. WNP005 (`Wnioski rozliczeniowe/Postaw na Siebie/wniosek_7.5_0172-WNP005.pdf`) – wniosek zbiorczy, do cross-checku kwot

### Po zaimportowaniu
- Widok zdarzeń per uczestnik (kolumna "Zdarzenia" w tabeli uczestników)
- Kalendarz z rozliczeniem sal per miesiąc

---

## Pliki kluczowe
```
src/
├── app/projects/[id]/
│   ├── page.tsx                    ← projekt detail + quick nav
│   ├── tasks/page.tsx              ← zadania + podzadania + umowy sub-rows
│   ├── events/page.tsx             ← lista zdarzeń + filtry + edycja
│   ├── events/new/page.tsx         ← formularz nowego zdarzenia
│   ├── participants/page.tsx       ← uczestnicy
│   ├── contractors/page.tsx        ← wykonawcy CRUD
│   ├── contracts/page.tsx          ← umowy CRUD + edit
│   └── settlement/page.tsx         ← rozliczenie miesięczne
├── components/layout/
│   ├── sidebar.tsx                 ← sidebar z projektami
│   └── header.tsx
Uczestnicy-projektow/
└── PnS_Uczestnicy_projektu_Efs_2026-04-01.csv   ← dane do importu
Wnioski rozliczeniowe/Postaw na Siebie/
└── wniosek_7.5_0172-WNP005.pdf                  ← WNP005 (zbiorczy, str.38)
```
