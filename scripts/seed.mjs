// GrantPilot – Seed script
// Uruchom: node scripts/seed.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  'https://pkswbzifdhdgavpccfpu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrc3diemlmZGhkZ2F2cGNjZnB1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA0MjI2NCwiZXhwIjoyMDkwNjE4MjY0fQ.VbSFWmoAUY024ShxTOQUs5QGLVEpCsoAOT99iudMOtA',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str || !str.trim()) return null
  // Wiele dat rozdzielonych | – bierz pierwszą
  str = str.split('|')[0].trim()
  if (!str) return null
  if (/^\d{2}\.\d{2}\.\d{4}/.test(str)) {
    const [d, m, y] = str.split(' ')[0].split('.')
    return `${y}-${m}-${d}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split(' ')[0]
  return null
}

function parseBool(str) {
  return (str || '').trim().toLowerCase() === 'tak'
}

function parseCSV(filepath) {
  const lines = readFileSync(filepath, 'utf8').split('\n').filter(l => l.trim())
  const headers = lines[0].split(';')
  return lines.slice(1).map(line => {
    const vals = line.split(';')
    const obj = {}
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim() })
    return obj
  })
}

function mapParticipant(row, projectId) {
  return {
    project_id: projectId,
    first_name: row['Imię'] || '',
    last_name: row['Nazwisko'] || '',
    pesel: row['PESEL/Inny identyfikator'] || null,
    no_pesel: parseBool(row['brak PESEL']),
    technical_id: row['Techniczny identyfikator uczestnika'] || null,
    gender: row['Płeć'] === 'Kobieta' ? 'K' : row['Płeć'] === 'Mężczyzna' ? 'M' : null,
    age_at_start: parseInt(row['Wiek w chwili przystąpienia do projektu']) || null,
    education_level: row['Wykształcenie'] || null,
    nationality: row['Obywatelstwo'] || 'Obywatelstwo polskie',
    country: row['Kraj'] || 'Polska',
    voivodeship: row['Województwo'] || null,
    county: row['Powiat'] || null,
    commune: row['Gmina'] || null,
    city: row['Miejscowość'] || null,
    postal_code: row['Kod pocztowy'] || null,
    degurba: parseInt(row['Obszar według stopnia urbanizacji (DEGURBA)']) || null,
    phone: row['Telefon kontaktowy'] || null,
    email: row['Adres e-mail'] || null,
    employment_status: row['Status osoby na rynku pracy w chwili przystąpienia do projektu'] || null,
    employment_detail: row['w tym'] || null,
    support_type: row['Zakres wsparcia'] || null,
    support_form: row['Rodzaj przyznanego wsparcia'] || null,
    support_start_date: parseDate(row['Data rozpoczęcia udziału we wsparciu']),
    project_start_date: parseDate(row['Data rozpoczęcia udziału w projekcie']),
    project_end_date: parseDate(row['Data zakończenia udziału w projekcie']),
    situation_at_end: row['Sytuacja osoby w momencie zakończenia udziału w projekcie'] || null,
    completed_path: row['Zakończenie udziału osoby w projekcie zgodnie z zaplanowaną dla niej ścieżką uczestnictwa'] === 'Tak' ? true : null,
    disability: parseBool(row['Osoba z niepełnosprawnościami']),
    foreign_origin: parseBool(row['Osoba obcego pochodzenia']),
    third_country_citizen: parseBool(row['Obywatel państwa trzeciego']),
    minority: parseBool(row['Osoba należąca do mniejszości narodowej lub etnicznej (w tym społeczności marginalizowane)']),
    homeless: parseBool(row['Osoba bezdomna lub dotknięta wykluczeniem z dostępu do mieszkań']),
    sl_added_by: row['Użytkownik, który dodał uczestnika'] || null,
    source: 'import',
  }
}

// Helper: insert only if table empty
async function insertIfEmpty(table, rows, label) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (count > 0) {
    console.log(`  ✓ ${label} (${count} już w bazie – pomijam)`)
    const { data } = await supabase.from(table).select('*')
    return data
  }
  const { data, error } = await supabase.from(table).insert(rows).select()
  if (error) { console.error(`  ✗ Błąd ${label}:`, error.message); return [] }
  console.log(`  ✓ ${label}: ${data.length} wpisów`)
  return data
}

// Helper: insert participants for one project if none exist
async function insertParticipants(projectId, rows, label) {
  const { count } = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  if (count > 0) {
    console.log(`  ✓ ${label} (${count} już w bazie – pomijam)`)
    return count
  }
  let inserted = 0
  for (let i = 0; i < rows.length; i += 50) {
    const { data, error } = await supabase.from('participants').insert(rows.slice(i, i + 50)).select()
    if (error) console.error(`  ✗ Błąd batch ${i}:`, error.message)
    else inserted += data.length
  }
  console.log(`  ✓ ${label}: ${inserted} uczestników`)
  return inserted
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 GrantPilot seed start\n')

  // 1. Organizacje
  console.log('📦 Organizacje...')
  const orgs = await insertIfEmpty('organizations', [
    { name: 'Fundacja Pretium', nip: '8971811633', address: 'ul. Stefana Żeromskiego 62/2, 50-312 Wrocław', type: 'own' },
    { name: 'RESQL Spółka z o.o.', nip: '1133016087', address: 'ul. Chodakowska 19/31, 03-815 Warszawa', type: 'external' },
    { name: 'EDUCANDIS Sp. z o.o.', nip: null, address: null, type: 'own' },
    { name: 'Fundacja Ars Auxilium', nip: null, address: null, type: 'external' },
  ], 'organizacje')
  const pretiumId = orgs.find(o => o.nip === '8971811633')?.id

  // 2. Projekty
  console.log('\n📁 Projekty...')
  const projects = await insertIfEmpty('projects', [
    {
      project_number: 'FEDS.07.03-IP.02-0039/25',
      name: 'Równość na co dzień – przeciwdziałanie dyskryminacji i przemocy',
      short_name: 'Równość na co dzień',
      organization_id: pretiumId,
      is_subcontractor: false,
      start_date: '2025-09-01',
      end_date: '2027-01-31',
      indirect_cost_rate: 0.20,
      total_budget: 905509.25,
      grant_amount: 905509.25,
      advance_received: 600000,
      status: 'active',
      notes: 'Działanie 7.3 FEDS 2021-2027 | Dolnośląski WUP | Nr naboru FEDS.07.03-IP.02-169/24',
    },
    {
      project_number: 'FEDS.07.05-IP.02-0172/24',
      name: 'Postaw na siebie',
      short_name: 'Postaw Na Siebie',
      organization_id: pretiumId,
      is_subcontractor: false,
      start_date: '2025-03-01',
      end_date: '2026-08-31',
      indirect_cost_rate: 0.20,
      total_budget: 2087688.67,
      grant_amount: 2087688.67,
      advance_received: 0,
      status: 'active',
      notes: 'Aktywizacja zawodowa | 80 os. 18-29 lat',
    },
  ], 'projekty')
  const rownosc = projects.find(p => p.project_number === 'FEDS.07.03-IP.02-0039/25')
  const postaw = projects.find(p => p.project_number === 'FEDS.07.05-IP.02-0172/24')
  if (!rownosc || !postaw) { console.error('Brak projektów – stop.'); return }

  // 3. Zadania – Równość
  console.log('\n📋 Zadania – Równość...')
  const { count: rTaskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', rownosc.id)
  let rTasks = []
  if (rTaskCount > 0) {
    const { data } = await supabase.from('tasks').select('*').eq('project_id', rownosc.id)
    rTasks = data
    console.log(`  ✓ zadania Równość (${rTaskCount} już w bazie – pomijam)`)
  } else {
    const { data, error } = await supabase.from('tasks').insert([
      { project_id: rownosc.id, number: 1, name: 'Kampania informacyjna', description: 'Filmy edukacyjne, podcasty, social media', budget_direct: 75150, budget_indirect: 15030 },
      { project_id: rownosc.id, number: 2, name: 'Konferencje', description: 'Kadra oświaty (100 os.) + kadra ochrony zdrowia (60 os.)', budget_direct: 82240, budget_indirect: 16448 },
      { project_id: rownosc.id, number: 3, name: 'Wdrożenie systemu RESQL w szkołach', description: '30 szkół | szkolenia personelu | zajęcia dla uczniów', budget_direct: 0, budget_indirect: 0 },
      { project_id: rownosc.id, number: 4, name: 'Centrum Wsparcia', description: 'Wsparcie psychologiczne i pedagogiczne | ul. Bierutowska 57-59 Wrocław', budget_direct: 362880, budget_indirect: 72576 },
      { project_id: rownosc.id, number: 5, name: 'Szkolenia dla pracowników służby zdrowia', description: '10 edycji × 20 os. = 200 os. | jednodniowe 8h', budget_direct: 17600, budget_indirect: 3520 },
      { project_id: rownosc.id, number: 6, name: 'Koszty pośrednie', description: 'Ryczałt 20%', budget_direct: 0, budget_indirect: 107574 },
    ]).select()
    if (error) { console.error('Błąd zadania:', error.message); return }
    rTasks = data
    console.log(`  ✓ zadania Równość: ${data.length}`)
  }

  // 4. Pozycje budżetowe – Równość
  console.log('\n💰 Pozycje budżetowe – Równość...')
  const { count: blCount } = await supabase.from('budget_lines').select('*', { count: 'exact', head: true }).eq('project_id', rownosc.id)
  if (blCount > 0) {
    console.log(`  ✓ pozycje budżetowe (${blCount} już w bazie – pomijam)`)
  } else {
    const z1 = rTasks.find(t => t.number === 1)?.id
    const z2 = rTasks.find(t => t.number === 2)?.id
    const z4 = rTasks.find(t => t.number === 4)?.id
    const z5 = rTasks.find(t => t.number === 5)?.id
    const { data, error } = await supabase.from('budget_lines').insert([
      { task_id: z1, project_id: rownosc.id, name: 'Przygotowanie 4 filmów edukacyjnych', unit: 'szt', unit_cost: 8000, quantity_planned: 4, amount_planned: 32000, category: 'subcontracting' },
      { task_id: z1, project_id: rownosc.id, name: 'Przygotowanie 2 podcastów', unit: 'szt', unit_cost: 5000, quantity_planned: 2, amount_planned: 10000, category: 'subcontracting' },
      { task_id: z1, project_id: rownosc.id, name: 'Prowadzenie social media (FB/IG/TikTok)', unit: 'miesiąc', unit_cost: 1950, quantity_planned: 17, amount_planned: 33150, category: 'subcontracting' },
      { task_id: z2, project_id: rownosc.id, name: 'Organizacja konferencji (łącznie 2)', unit: 'szt', unit_cost: 82240, quantity_planned: 1, amount_planned: 82240, category: 'subcontracting' },
      { task_id: z4, project_id: rownosc.id, name: 'Wynagrodzenie pedagogów (2 os. etat)', unit: 'osobomiesiąc', unit_cost: 8300, quantity_planned: 32, amount_planned: 265600, category: 'personnel' },
      { task_id: z4, project_id: rownosc.id, name: 'Pedagodzy na zlecenie – linia zaufania', unit: 'godzina', unit_cost: 80, quantity_planned: 600, amount_planned: 48000, category: 'subcontracting' },
      { task_id: z4, project_id: rownosc.id, name: 'Psycholog / interwent kryzysowy', unit: 'godzina', unit_cost: 220, quantity_planned: 224, amount_planned: 49280, category: 'subcontracting', notes: '14h/mc × 16 mc | konsultacje + interwencja kryzysowa' },
      { task_id: z5, project_id: rownosc.id, name: 'Prowadzący szkolenia (umowa cywilnoprawna)', unit: 'godzina', unit_cost: 220, quantity_planned: 80, amount_planned: 17600, category: 'subcontracting', notes: '8h × 10 edycji' },
    ]).select()
    if (error) console.error('Błąd budget_lines:', error.message)
    else console.log(`  ✓ pozycje budżetowe Równość: ${data.length}`)
  }

  // 5. Zadania – Postaw Na Siebie
  console.log('\n📋 Zadania – Postaw Na Siebie...')
  const { count: pTaskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('project_id', postaw.id)
  if (pTaskCount > 0) {
    console.log(`  ✓ zadania Postaw (${pTaskCount} już w bazie – pomijam)`)
  } else {
    const { data, error } = await supabase.from('tasks').insert([
      { project_id: postaw.id, number: 1, name: 'Diagnoza i opracowanie IPD', description: 'Indywidualne Plany Działania dla 80 UP', budget_direct: 75600, budget_indirect: 15120 },
      { project_id: postaw.id, number: 2, name: 'Treningi umiejętności społecznych', description: 'Treningi kompetencji', budget_direct: 98640, budget_indirect: 19728 },
      { project_id: postaw.id, number: 3, name: 'Szkolenia cyfrowe', description: 'Podnoszenie kompetencji cyfrowych', budget_direct: 183155, budget_indirect: 36631 },
      { project_id: postaw.id, number: 4, name: 'Indywidualne poradnictwo', description: 'Psychologiczne, prawne, zawodowe', budget_direct: 0, budget_indirect: 0 },
      { project_id: postaw.id, number: 5, name: 'Szkolenia zawodowe', description: 'Szkolenia dostosowane do rynku pracy', budget_direct: 0, budget_indirect: 0 },
      { project_id: postaw.id, number: 6, name: 'Staże', description: '62 UP × ~4 mc | stypendium 1994,40 zł/mc', budget_direct: 744649, budget_indirect: 148930 },
      { project_id: postaw.id, number: 7, name: 'Indywidualne pośrednictwo pracy', description: 'Wsparcie w znalezieniu zatrudnienia', budget_direct: 49800, budget_indirect: 9960 },
      { project_id: postaw.id, number: 8, name: 'Indywidualny mentoring', description: 'Mentoring zawodowy', budget_direct: 17600, budget_indirect: 3520 },
      { project_id: postaw.id, number: 9, name: 'Koszty pośrednie', description: 'Ryczałt 20%', budget_direct: 0, budget_indirect: 347948 },
    ]).select()
    if (error) console.error('Błąd zadania Postaw:', error.message)
    else console.log(`  ✓ zadania Postaw: ${data.length}`)
  }

  // 6. Okresy rozliczeniowe – Równość
  console.log('\n📅 Okresy WNP – Równość...')
  const { count: wnpCount } = await supabase.from('settlement_periods').select('*', { count: 'exact', head: true }).eq('project_id', rownosc.id)
  if (wnpCount > 0) {
    console.log(`  ✓ WNP (${wnpCount} już w bazie – pomijam)`)
  } else {
    const { error } = await supabase.from('settlement_periods').insert([
      { project_id: rownosc.id, number: 2, period_start: '2025-09-01', period_end: '2025-11-30', status: 'approved', advance_received: true, advance_amount: 200000, total_claimed: 40000, notes: 'WNP002 – zatwierdzony' },
      { project_id: rownosc.id, number: 3, period_start: '2025-12-01', period_end: '2026-02-28', status: 'draft', total_claimed: 100401.91, notes: 'WNP003 – w przygotowaniu' },
      { project_id: rownosc.id, number: 4, period_start: '2026-03-01', period_end: '2026-08-31', status: 'draft', notes: 'WNP004 – planowany koniec sierpnia 2026' },
    ])
    if (error) console.error('Błąd WNP:', error.message)
    else console.log('  ✓ 3 okresy WNP')
  }

  // 7. Uczestnicy – Równość
  console.log('\n👥 Uczestnicy – Równość na co dzień...')
  const rCSV = parseCSV('C:/VisualStudioFolders/rownosc-na-co-dzien/Wnioski o płatność/Uczestnicy_projektu_Efs_2026-03-10.csv')
  await insertParticipants(rownosc.id, rCSV.map(r => mapParticipant(r, rownosc.id)), 'Równość (132 os.)')

  // 8. Uczestnicy – Postaw Na Siebie
  console.log('\n👥 Uczestnicy – Postaw Na Siebie...')
  const pCSV = parseCSV('C:/VisualStudioFolders/rownosc-na-co-dzien/Uczestnicy_projektu_Efs_2026-04-01.csv')
  await insertParticipants(postaw.id, pCSV.map(r => mapParticipant(r, postaw.id)), 'Postaw (47 os.)')

  // 9. Podsumowanie
  const { count: totalP } = await supabase.from('participants').select('*', { count: 'exact', head: true })
  const { count: totalT } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
  const { count: totalBL } = await supabase.from('budget_lines').select('*', { count: 'exact', head: true })
  console.log('\n✅ Seed zakończony!')
  console.log(`\n📊 Stan bazy:`)
  console.log(`   Projekty:         2`)
  console.log(`   Zadania:          ${totalT}`)
  console.log(`   Pozycje budż.:    ${totalBL}`)
  console.log(`   Uczestnicy:       ${totalP}`)
  console.log('\n🔑 Hasła: GrantPilot2026!')
}

seed().catch(console.error)
