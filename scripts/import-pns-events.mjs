/**
 * Import zdarzeń z CSV SL2014 → Supabase
 * Projekt: Postaw na Siebie (FEDS.07.05-IP.02-0172/24)
 *
 * Uruchomienie:
 *   node scripts/import-pns-events.mjs [--dry-run] [--project-id <uuid>]
 *
 * Flagi:
 *   --dry-run      Tylko parsuje i wypisuje zdarzenia, nie insertuje do Supabase
 *   --project-id   UUID projektu PnS w Supabase (jeśli nie podano, skrypt szuka po numerze projektu)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Konfiguracja ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CSV_PATH = path.resolve(
  __dirname,
  '../Uczestnicy-projektow/PnS_Uczestnicy_projektu_Efs_2026-04-01.csv'
);

const PNS_PROJECT_NUMBER = 'FEDS.07.05-IP.02-0172/24';

// Mapowanie: (rodzaj_wsparcia, w_tym) → klucz podzadania
// Klucze muszą pasować do nazw budget_lines w Supabase
const SUPPORT_MAPPING = [
  {
    rodzaj: 'doradztwo/konsultacje',
    w_tym: 'pomoc psychologiczna',
    budgetLineKey: 'psycholog',
    eventType: 'consulting',
    nameTemplate: 'Konsultacja psychologiczna',
  },
  {
    rodzaj: 'doradztwo/konsultacje',
    w_tym: 'doradztwo zawodowe',
    budgetLineKey: 'doradca_zawodowy',
    eventType: 'consulting',
    nameTemplate: 'Doradztwo zawodowe',
  },
  {
    rodzaj: 'krajowe szkolenie/kurs',
    w_tym: '',
    budgetLineKey: 'szkolenia_zawodowe',
    eventType: 'training',
    nameTemplate: 'Szkolenie zawodowe',
  },
  {
    rodzaj: 'usługa aktywnej integracji',
    w_tym: 'usługa o charakterze zawodowym',
    budgetLineKey: 'staze_praktyki',
    eventType: 'other',
    nameTemplate: 'Staż/praktyka zawodowa',
  },
  {
    rodzaj: 'usługa aktywnej integracji',
    w_tym: 'usługa o charakterze społecznym',
    budgetLineKey: 'warsztaty_spoleczne',
    eventType: 'workshop',
    nameTemplate: 'Warsztaty społeczne',
  },
  {
    rodzaj: 'doradztwo/konsultacje',
    w_tym: 'doradztwo/ pomoc prawna',
    budgetLineKey: 'pomoc_prawna',
    eventType: 'consulting',
    nameTemplate: 'Pomoc prawna',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(s) {
  return (s || '').trim().toLowerCase();
}

function matchSupport(rodzaj, wTym) {
  const r = normalizeText(rodzaj);
  const w = normalizeText(wTym);
  return SUPPORT_MAPPING.find(
    (m) => normalizeText(m.rodzaj) === r && normalizeText(m.w_tym) === w
  );
}

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = lines[0].split(';').map((h) => h.trim());

  const col = (name) => {
    const idx = headers.findIndex((h) => h === name);
    if (idx === -1) throw new Error(`Kolumna nie znaleziona: "${name}"`);
    return idx;
  };

  const iImie = col('Imię');
  const iNazwisko = col('Nazwisko');
  const iPesel = col('PESEL/Inny identyfikator');
  const iTechId = col('Techniczny identyfikator uczestnika');
  const iZakres = col('Zakres wsparcia');
  const iRodzaj = col('Rodzaj przyznanego wsparcia');
  const iWTym = col('w tym');   // drugie "w tym" (col 31)
  const iDataWsparcia = col('Data rozpoczęcia udziału we wsparciu');

  // Sprawdzamy który indeks jest poprawny dla "w tym" (wsparcia)
  // W CSV są dwa pola "w tym" — pierwsze (col 25) = status rynku pracy, drugie (col 31) = podtyp wsparcia
  const allWTym = headers.reduce((acc, h, i) => {
    if (h === 'w tym') acc.push(i);
    return acc;
  }, []);
  const iWTymWsparcia = allWTym.length >= 2 ? allWTym[1] : iWTym;

  const participants = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';');
    const pesel = cells[iPesel]?.trim() || '';
    const techId = cells[iTechId]?.trim() || '';
    const imie = cells[iImie]?.trim() || '';
    const nazwisko = cells[iNazwisko]?.trim() || '';

    const zakresPipe = cells[iZakres]?.trim() || '';
    const rodzajPipe = cells[iRodzaj]?.trim() || '';
    const wTymPipe = cells[iWTymWsparcia]?.trim() || '';
    const dataPipe = cells[iDataWsparcia]?.trim() || '';

    if (!rodzajPipe) continue; // brak wsparć — pomijamy

    const rodzaje = rodzajPipe.split('|');
    const wTymy = wTymPipe.split('|');
    const daty = dataPipe.split('|');

    const supports = rodzaje.map((r, idx) => ({
      rodzaj: r.trim(),
      w_tym: (wTymy[idx] || '').trim(),
      data: (daty[idx] || '').trim(),
    }));

    participants.push({ imie, nazwisko, pesel, techId, supports });
  }

  return participants;
}

// Buduje klucz zdarzenia grupowego: (budgetLineKey, data)
function eventKey(budgetLineKey, date) {
  return `${budgetLineKey}__${date}`;
}

function groupIntoEvents(participants) {
  // Mapa: eventKey → { mapping, date, participants: [{imie, nazwisko, pesel, techId}] }
  const eventsMap = new Map();

  for (const p of participants) {
    for (const s of p.supports) {
      const mapping = matchSupport(s.rodzaj, s.w_tym);
      if (!mapping) {
        console.warn(
          `  ⚠ Nieznane wsparcie: "${s.rodzaj}" / "${s.w_tym}" — pominięto (${p.imie} ${p.nazwisko})`
        );
        continue;
      }

      const key = eventKey(mapping.budgetLineKey, s.data);
      if (!eventsMap.has(key)) {
        eventsMap.set(key, {
          mapping,
          date: s.data,
          participants: [],
        });
      }

      const existing = eventsMap.get(key);
      // Unikaj duplikatów per uczestnik per zdarzenie
      const alreadyIn = existing.participants.some(
        (ep) => ep.pesel === p.pesel && ep.pesel !== ''
        || ep.techId === p.techId && ep.techId !== ''
      );
      if (!alreadyIn) {
        existing.participants.push({
          imie: p.imie,
          nazwisko: p.nazwisko,
          pesel: p.pesel,
          techId: p.techId,
        });
      }
    }
  }

  return eventsMap;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const projectIdArg = args.includes('--project-id')
    ? args[args.indexOf('--project-id') + 1]
    : null;

  console.log('=== Import PnS → Supabase ===');
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`Tryb: ${dryRun ? 'DRY RUN (bez insertu)' : 'ZAPIS DO SUPABASE'}\n`);

  // 1. Parsuj CSV
  const participants = parseCSV(CSV_PATH);
  console.log(`Uczestnicy z danymi wsparcia: ${participants.length}`);

  // 2. Grupuj w zdarzenia
  const eventsMap = groupIntoEvents(participants);
  console.log(`Zdarzenia zgrupowane: ${eventsMap.size}\n`);

  // Podgląd
  for (const [key, ev] of eventsMap) {
    console.log(
      `  [${ev.mapping.budgetLineKey}] ${ev.date || '(brak daty)'}  →  ${ev.mapping.nameTemplate}  (${ev.participants.length} uczestników)`
    );
  }

  if (dryRun) {
    console.log('\n✅ Dry run zakończony. Brak zmian w bazie.');
    return;
  }

  // 3. Połącz z Supabase
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Brak zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Uruchom: export $(cat .env.local | xargs) && node scripts/import-pns-events.mjs'
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 4. Znajdź projekt PnS
  let projectId = projectIdArg;
  if (!projectId) {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, project_number')
      .eq('project_number', PNS_PROJECT_NUMBER)
      .limit(1);

    if (error) throw new Error(`Błąd pobierania projektu: ${error.message}`);
    if (!projects?.length) {
      throw new Error(
        `Nie znaleziono projektu o numerze "${PNS_PROJECT_NUMBER}". ` +
        'Podaj --project-id <uuid> ręcznie.'
      );
    }
    projectId = projects[0].id;
    console.log(`\nProjekt: ${projects[0].name} (${projectId})`);
  }

  // 5. Pobierz budget_lines projektu
  const { data: budgetLines, error: blErr } = await supabase
    .from('budget_lines')
    .select('id, name, sub_number')
    .eq('project_id', projectId);

  if (blErr) throw new Error(`Błąd pobierania budget_lines: ${blErr.message}`);
  console.log(`Budget lines dostępne: ${budgetLines.length}`);

  // Mapowanie budgetLineKey → sub_number (pierwsza pasująca linia)
  // sub_number z Supabase: 1.1=doradca zawod IPD, 1.2=psycholog IPD, 2.1=trenerzy TSK,
  // 5.1=szkolenia zawod, 6.1=staże, 4.5=pomoc prawna MID, 8.1=mentoring
  const BUDGET_LINE_SUB = {
    psycholog: ['1.2', '4.1', '4.2'],
    doradca_zawodowy: ['1.1', '4.7'],
    szkolenia_zawodowe: ['5.1'],
    staze_praktyki: ['6.1'],
    warsztaty_spoleczne: ['8.1'],
    pomoc_prawna: ['4.5'],
  };

  function findBudgetLine(key) {
    const subNumbers = BUDGET_LINE_SUB[key] || [];
    return budgetLines.find((bl) => subNumbers.includes(bl.sub_number));
  }

  // 6. Pobierz uczestników projektu z Supabase (do dopasowania po PESEL/techId)
  const { data: dbParticipants, error: pErr } = await supabase
    .from('participants')
    .select('id, pesel, technical_id, first_name, last_name')
    .eq('project_id', projectId);

  if (pErr) throw new Error(`Błąd pobierania uczestników: ${pErr.message}`);
  console.log(`Uczestnicy w Supabase: ${dbParticipants.length}\n`);

  function findParticipantId(p) {
    if (p.pesel) {
      const found = dbParticipants.find((dp) => dp.pesel === p.pesel);
      if (found) return found.id;
    }
    if (p.techId) {
      const found = dbParticipants.find((dp) => dp.technical_id === p.techId);
      if (found) return found.id;
    }
    return null;
  }

  // 7. Insertuj zdarzenia i uczestników
  let insertedEvents = 0;
  let insertedParticipants = 0;
  let skippedEvents = 0;

  for (const [key, ev] of eventsMap) {
    const budgetLine = findBudgetLine(ev.mapping.budgetLineKey);
    if (!budgetLine) {
      console.warn(
        `  ⚠ Brak budget_line dla klucza "${ev.mapping.budgetLineKey}" — zdarzenie pominięte`
      );
      skippedEvents++;
      continue;
    }

    // Sprawdź czy zdarzenie już istnieje (deduplikacja po budget_line_id + planned_date)
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('project_id', projectId)
      .eq('budget_line_id', budgetLine.id)
      .eq('planned_date', ev.date || null)
      .limit(1);

    let eventId;
    if (existing?.length) {
      eventId = existing[0].id;
      console.log(
        `  ↩ Zdarzenie już istnieje: ${ev.mapping.nameTemplate} ${ev.date} (${eventId}) — pomijam insert, dodaję tylko nowych uczestników`
      );
    } else {
      // Insert nowego zdarzenia
      const eventPayload = {
        project_id: projectId,
        budget_line_id: budgetLine.id,
        name: ev.date
          ? `${ev.mapping.nameTemplate} (${ev.date})`
          : ev.mapping.nameTemplate,
        type: ev.mapping.eventType,
        status: 'planned',
        planned_date: ev.date || null,
        planned_participants_count: ev.participants.length,
        notes: `Import z SL2014 (CSV 2026-04-01)`,
      };

      const { data: newEvent, error: evErr } = await supabase
        .from('events')
        .insert(eventPayload)
        .select('id')
        .single();

      if (evErr) {
        console.error(`  ✗ Błąd insertu zdarzenia: ${evErr.message}`);
        skippedEvents++;
        continue;
      }

      eventId = newEvent.id;
      insertedEvents++;
      console.log(`  ✓ Zdarzenie: ${ev.mapping.nameTemplate} ${ev.date} → ${eventId}`);
    }

    // Insert uczestników do event_participants
    for (const p of ev.participants) {
      const participantId = findParticipantId(p);
      if (!participantId) {
        console.warn(
          `    ⚠ Uczestnik nieznaleziony w Supabase: ${p.imie} ${p.nazwisko} (PESEL: ${p.pesel || 'brak'}) — pomijam`
        );
        continue;
      }

      // Sprawdź czy już jest w tym zdarzeniu
      const { data: epExisting } = await supabase
        .from('event_participants')
        .select('id')
        .eq('event_id', eventId)
        .eq('participant_id', participantId)
        .limit(1);

      if (epExisting?.length) continue;

      const { error: epErr } = await supabase.from('event_participants').insert({
        event_id: eventId,
        participant_id: participantId,
        status: 'planned',
      });

      if (epErr) {
        console.error(
          `    ✗ Błąd dodawania uczestnika ${p.imie} ${p.nazwisko}: ${epErr.message}`
        );
      } else {
        insertedParticipants++;
      }
    }
  }

  console.log('\n=== Podsumowanie ===');
  console.log(`  Nowe zdarzenia:          ${insertedEvents}`);
  console.log(`  Pominięte zdarzenia:     ${skippedEvents}`);
  console.log(`  Nowi event_participants: ${insertedParticipants}`);
  console.log('\n✅ Import zakończony.');
}

main().catch((err) => {
  console.error('\n❌ Błąd krytyczny:', err.message);
  process.exit(1);
});
