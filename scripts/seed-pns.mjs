// GrantPilot – Seed Postaw Na Siebie: podzadania budzetowe + formy wsparcia
// Uruchom PO wykonaniu migration_001 w Supabase!
// node scripts/seed-pns.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pkswbzifdhdgavpccfpu.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrc3diemlmZGhkZ2F2cGNjZnB1Iiwicm9sZSI6' +
  'InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA0MjI2NCwiZXhwIjoyMDkwNjE4MjY0fQ' +
  '.VbSFWmoAUY024ShxTOQUs5QGLVEpCsoAOT99iudMOtA'

const sb = createClient(SUPABASE_URL, SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  console.log('🌱 Seed PnS: podzadania + formy wsparcia\n')

  // Pobierz projekt PnS
  const { data: projects } = await sb.from('projects').select('id, project_number')
  const pns = projects.find(p => p.project_number === 'FEDS.07.05-IP.02-0172/24')
  if (!pns) { console.error('Brak projektu PnS'); return }
  console.log(`Projekt PnS id: ${pns.id.slice(0,8)}`)

  // Pobierz zadania PnS
  const { data: tasks } = await sb.from('tasks').select('id, number, name').eq('project_id', pns.id).order('number')
  const T = {}
  tasks.forEach(t => { T[t.number] = t.id })
  console.log(`Zadania: ${tasks.map(t => t.number + '.' + t.name.split(' ')[0]).join(', ')}\n`)

  // Pobierz organizacje
  const { data: orgs } = await sb.from('organizations').select('id, name')
  const orgId = (name) => orgs.find(o => o.name.toLowerCase().includes(name.toLowerCase()))?.id

  // ─── 1. Wyczyść stare budget_lines dla PnS ─────────────────────────────────
  console.log('🗑  Czyszczę stare pozycje budżetowe PnS...')
  await sb.from('budget_lines').delete().eq('project_id', pns.id)
  console.log('  ✓\n')

  // ─── 2. Wgraj podzadania budżetowe PnS ──────────────────────────────────────
  console.log('💰 Wgrywam podzadania budżetowe PnS (17 pozycji)...')
  const budgetLines = [
    // ZADANIE 1 – IPD
    { task_id: T[1], project_id: pns.id, sub_number: '1.1', line_type: 'W', contractor_name: 'Educandis',
      name: 'Wynagrodzenie doradców zawodowych – IPD', category: 'subcontracting',
      unit: 'godzina', unit_cost: 165, quantity_planned: 160, amount_planned: 26400,
      participants_target: 80, hours_per_participant: 2, total_hours: 160,
      budget_type: 'dofinansowanie', notes: '80 UP × 2h, umowa zlecenie brutto+narzuty' },
    { task_id: T[1], project_id: pns.id, sub_number: '1.2', line_type: 'W', contractor_name: 'Educandis',
      name: 'Wynagrodzenie psychologów – IPD', category: 'subcontracting',
      unit: 'godzina', unit_cost: 200, quantity_planned: 160, amount_planned: 32000,
      participants_target: 80, hours_per_participant: 2, total_hours: 160,
      budget_type: 'dofinansowanie', notes: '80 UP × 2h, umowa zlecenie brutto+narzuty' },
    { task_id: T[1], project_id: pns.id, sub_number: '1.3', line_type: 'S', contractor_name: 'Educandis',
      name: 'Udostępnienie sal – IPD', category: 'other',
      unit: 'godzina', unit_cost: 50, quantity_planned: 320, amount_planned: 16000,
      participants_target: 80, hours_per_participant: 4, total_hours: 320,
      room_rate: 50, budget_type: 'wklad_wlasny', notes: 'Wkład niepieniężny – sala dla 1.1 i 1.2' },

    // ZADANIE 2 – TSK
    { task_id: T[2], project_id: pns.id, sub_number: '2.1', line_type: 'W', contractor_name: 'ARS',
      name: 'Wynagrodzenie trenerów – TSK', category: 'subcontracting',
      unit: 'godzina', unit_cost: 170, quantity_planned: 288, amount_planned: 48960,
      participants_target: 8, hours_per_participant: 36, total_hours: 288,
      budget_type: 'dofinansowanie', notes: '8 grup × 3 tematy × 12h, umowa zlecenie' },
    { task_id: T[2], project_id: pns.id, sub_number: '2.2', line_type: 'S', contractor_name: 'ARS',
      name: 'Wynajem sal – TSK', category: 'other',
      unit: 'godzina', unit_cost: 80, quantity_planned: 288, amount_planned: 23040,
      participants_target: 8, hours_per_participant: 36, total_hours: 288,
      room_rate: 80, budget_type: 'wklad_wlasny', notes: '8 grup × 3 tematy × 12h' },

    // ZADANIE 3 – Cyfrowe
    { task_id: T[3], project_id: pns.id, sub_number: '3.1', line_type: 'W', contractor_name: 'ARS',
      name: 'Wynagrodzenie trenerów – Szkolenie cyfrowe', category: 'subcontracting',
      unit: 'godzina', unit_cost: 160, quantity_planned: 288, amount_planned: 46080,
      participants_target: 8, hours_per_participant: 36, total_hours: 288,
      budget_type: 'dofinansowanie', notes: '8 grup × 36h, umowa zlecenie' },
    { task_id: T[3], project_id: pns.id, sub_number: '3.2', line_type: 'S', contractor_name: 'ARS',
      name: 'Wynajem sal komputerowych – Szkolenie cyfrowe', category: 'other',
      unit: 'godzina', unit_cost: 75, quantity_planned: 288, amount_planned: 21600,
      participants_target: 8, hours_per_participant: 36, total_hours: 288,
      room_rate: 75, budget_type: 'dofinansowanie' },

    // ZADANIE 4 – MID (Indywidualne poradnictwo)
    { task_id: T[4], project_id: pns.id, sub_number: '4.1', line_type: 'W', contractor_name: 'ARS',
      name: 'Wynagrodzenie psychologów – MID (ARS)', category: 'subcontracting',
      unit: 'godzina', unit_cost: 200, quantity_planned: 216, amount_planned: 43200,
      participants_target: 36, hours_per_participant: 6, total_hours: 216,
      budget_type: 'dofinansowanie', notes: '36 UP × 3 spotkania × 2h, umowa zlecenie' },
    { task_id: T[4], project_id: pns.id, sub_number: '4.2', line_type: 'W', contractor_name: 'Pretium',
      name: 'Wynagrodzenie psychologów – MID (wolontariat Pretium)', category: 'subcontracting',
      unit: 'godzina', unit_cost: 200, quantity_planned: 216, amount_planned: 43200,
      participants_target: 36, hours_per_participant: 6, total_hours: 216,
      budget_type: 'wklad_wlasny', notes: 'WOLONTARIAT – Fundacja Pretium' },
    { task_id: T[4], project_id: pns.id, sub_number: '4.3', line_type: 'S', contractor_name: 'Pretium',
      name: 'Udostępnienie sal – MID Psycholog', category: 'other',
      unit: 'godzina', unit_cost: 50, quantity_planned: 432, amount_planned: 21600,
      participants_target: 72, hours_per_participant: 6, total_hours: 432,
      room_rate: 50, budget_type: 'wklad_wlasny', notes: 'Wkład niepieniężny – sala dla 4.1 i 4.2 (36+36=72 UP)' },
    { task_id: T[4], project_id: pns.id, sub_number: '4.5', line_type: 'W', contractor_name: 'ARS',
      name: 'Wynagrodzenie doradców prawnych – MID', category: 'subcontracting',
      unit: 'godzina', unit_cost: 220, quantity_planned: 168, amount_planned: 36960,
      participants_target: 56, hours_per_participant: 3, total_hours: 168,
      budget_type: 'dofinansowanie', notes: '56 UP × 2 spotkania × 1.5h, umowa zlecenie' },
    { task_id: T[4], project_id: pns.id, sub_number: '4.7', line_type: 'W', contractor_name: 'Educandis',
      name: 'Wynagrodzenie doradców zawodowych – MID', category: 'subcontracting',
      unit: 'godzina', unit_cost: 165, quantity_planned: 240, amount_planned: 39600,
      participants_target: 80, hours_per_participant: 3, total_hours: 240,
      budget_type: 'dofinansowanie', notes: '80 UP × 2 spotkania × 1.5h, umowa zlecenie' },
    { task_id: T[4], project_id: pns.id, sub_number: '4.8', line_type: 'S', contractor_name: 'Educandis',
      name: 'Wynajem sal – MID Doradca (dofinansowanie)', category: 'other',
      unit: 'godzina', unit_cost: 50, quantity_planned: 200, amount_planned: 10000,
      total_hours: 200, room_rate: 50, budget_type: 'dofinansowanie', notes: '200h wynajmu' },
    { task_id: T[4], project_id: pns.id, sub_number: '4.9', line_type: 'S', contractor_name: 'Educandis',
      name: 'Udostępnienie sal – MID Doradca (wkład własny)', category: 'other',
      unit: 'godzina', unit_cost: 50, quantity_planned: 40, amount_planned: 2000,
      total_hours: 40, room_rate: 50, budget_type: 'wklad_wlasny', notes: '40h wkład własny' },

    // ZADANIE 5 – Szkolenia zawodowe (WNP005 str.37-38)
    { task_id: T[5], project_id: pns.id, sub_number: '5.1', line_type: 'W', contractor_name: 'Pretium',
      name: 'Pula środków na realizację szkoleń zawodowych', category: 'subcontracting',
      unit: 'osoba', unit_cost: 2600, quantity_planned: 80, amount_planned: 208000,
      participants_target: 80, hours_per_participant: 110, total_hours: 8800,
      budget_type: 'dofinansowanie', notes: '80 UP × 110h średnio × 2600 zł/UP – usługa zlecona' },
    { task_id: T[5], project_id: pns.id, sub_number: '5.2', line_type: 'W', contractor_name: 'Pretium',
      name: 'Badania lekarskie przed szkoleniami zawodowymi', category: 'other',
      unit: 'osoba', unit_cost: 130, quantity_planned: 40, amount_planned: 5200,
      participants_target: 40, total_hours: 0,
      budget_type: 'dofinansowanie', notes: '40 UP × 130 zł' },
    { task_id: T[5], project_id: pns.id, sub_number: '5.3', line_type: 'W', contractor_name: 'Pretium',
      name: 'Stypendia szkoleniowe – szkolenia zawodowe', category: 'other',
      unit: 'godzina', unit_cost: 13.29, quantity_planned: 8800, amount_planned: 116952,
      participants_target: 80, hours_per_participant: 110, total_hours: 8800,
      budget_type: 'dofinansowanie', notes: '80 UP × 110h × 13,29 zł' },
    { task_id: T[5], project_id: pns.id, sub_number: '5.4', line_type: 'W', contractor_name: 'Pretium',
      name: 'Składki ZUS od stypendiów szkoleniowych', category: 'other',
      unit: 'godzina', unit_cost: 3.88, quantity_planned: 8800, amount_planned: 34144,
      participants_target: 80, hours_per_participant: 110, total_hours: 8800,
      budget_type: 'dofinansowanie', notes: '80 UP × 110h × 3,88 zł' },

    // ZADANIE 6 – Staże (WNP005 str.38-39)
    { task_id: T[6], project_id: pns.id, sub_number: '6.1', line_type: 'W', contractor_name: 'Pretium',
      name: 'Stypendia stażowe', category: 'other',
      unit: 'miesiąc', unit_cost: 1994.40, quantity_planned: 248, amount_planned: 494611.20,
      participants_target: 62, hours_per_participant: 4, total_hours: 248,
      budget_type: 'dofinansowanie', notes: '62 UP × 4 miesiące × 1994,40 zł' },
    { task_id: T[6], project_id: pns.id, sub_number: '6.2', line_type: 'W', contractor_name: 'Pretium',
      name: 'Składki ZUS od stypendiów stażowych', category: 'other',
      unit: 'miesiąc', unit_cost: 582.17, quantity_planned: 248, amount_planned: 144378.16,
      participants_target: 62, total_hours: 0,
      budget_type: 'dofinansowanie', notes: '62 UP × 4 miesiące × 582,17 zł' },
    { task_id: T[6], project_id: pns.id, sub_number: '6.3', line_type: 'W', contractor_name: 'Pretium',
      name: 'Badania lekarskie przed stażem', category: 'other',
      unit: 'osoba', unit_cost: 130, quantity_planned: 62, amount_planned: 8060,
      participants_target: 62, total_hours: 0,
      budget_type: 'dofinansowanie', notes: '62 UP × 130 zł' },
    { task_id: T[6], project_id: pns.id, sub_number: '6.4', line_type: 'W', contractor_name: 'Pretium',
      name: 'Ubezpieczenie NNW na staż', category: 'other',
      unit: 'osoba', unit_cost: 50, quantity_planned: 62, amount_planned: 3100,
      participants_target: 62, total_hours: 0,
      budget_type: 'dofinansowanie', notes: '62 UP × 4 miesiące × 50 zł' },

    // ZADANIE 7 – PP
    { task_id: T[7], project_id: pns.id, sub_number: '7.1', line_type: 'W', contractor_name: 'Educandis',
      name: 'Wynagrodzenie pośredników pracy – PP', category: 'subcontracting',
      unit: 'godzina', unit_cost: 150, quantity_planned: 320, amount_planned: 48000,
      participants_target: 80, hours_per_participant: 4, total_hours: 320,
      budget_type: 'dofinansowanie', notes: '80 UP × 2 spotkania × 2h, umowa zlecenie' },

    // ZADANIE 8 – Mentoring
    { task_id: T[8], project_id: pns.id, sub_number: '8.1', line_type: 'W', contractor_name: 'ARS',
      name: 'Wynagrodzenie mentorów – Mentoring', category: 'subcontracting',
      unit: 'godzina', unit_cost: 170, quantity_planned: 80, amount_planned: 13600,
      participants_target: 80, hours_per_participant: 1, total_hours: 80,
      budget_type: 'dofinansowanie', notes: 'Pula 80 godzin × 170 zł' },
    { task_id: T[8], project_id: pns.id, sub_number: '8.2', line_type: 'S', contractor_name: 'ARS',
      name: 'Udostępnienie sal – Mentoring', category: 'other',
      unit: 'godzina', unit_cost: 50, quantity_planned: 80, amount_planned: 4000,
      participants_target: 80, hours_per_participant: 1, total_hours: 80,
      room_rate: 50, budget_type: 'dofinansowanie', notes: '80h × 50 zł' },
  ]

  const { data: blData, error: blErr } = await sb.from('budget_lines').insert(budgetLines).select()
  if (blErr) { console.error('Błąd budget_lines:', blErr.message); return }
  console.log(`  ✓ ${blData.length} podzadań budżetowych\n`)

  // Mapa sub_number → id
  const BL = {}
  blData.forEach(bl => { BL[bl.sub_number] = bl.id })

  // ─── 3. Wyczyść i wgraj formy wsparcia ──────────────────────────────────────
  console.log('📋 Wgrywam formy wsparcia PnS...')
  const { data: existingSF } = await sb.from('support_forms').select('id').eq('project_id', pns.id)
  if (existingSF?.length > 0) {
    await sb.from('support_forms').delete().eq('project_id', pns.id)
    console.log(`  Wyczyszczono ${existingSF.length} starych form`)
  }

  const supportForms = [
    { project_id: pns.id, task_id: T[1],
      code: '1.IPD | PnS | Doradztwo zawodowe | 2 | Educandis',
      name: 'IPD – Doradztwo zawodowe (Educandis)', support_type: 'Doradztwo zawodowe',
      meeting_type: 'Indywidualne', meetings_count: 1, hours_per_meeting: 2, hour_type: 'zegarowe',
      contractor_name: 'Educandis', rate_executor: 165, rate_room: 50,
      notes: 'Zadanie 1, wkład własny, sala: Educandis 50 PLN/h' },
    { project_id: pns.id, task_id: T[1],
      code: '1.IPD | PnS | Psycholog | 2 | Educandis',
      name: 'IPD – Psycholog (Educandis)', support_type: 'Psycholog',
      meeting_type: 'Indywidualne', meetings_count: 1, hours_per_meeting: 2, hour_type: 'zegarowe',
      contractor_name: 'Educandis', rate_executor: 200, rate_room: 50,
      notes: 'Zadanie 1, wkład własny, sala: Educandis 50 PLN/h' },
    { project_id: pns.id, task_id: T[2],
      code: '2.TSK | PnS | TSK | 6 | ARS',
      name: 'Trening kompetencji społecznych (ARS)', support_type: 'TSK',
      meeting_type: 'Grupowe 10 osób', meetings_count: 6, hours_per_meeting: 6, hour_type: 'dydaktyczne',
      contractor_name: 'ARS', rate_executor: 170, rate_room: 80,
      notes: 'Zadanie 2, 8 grup × 3 tematy × 12h' },
    { project_id: pns.id, task_id: T[3],
      code: '3.Cyfrowe | PnS | Szkolenie cyfrowe | 6 | ARS',
      name: 'Szkolenie cyfrowe (ARS)', support_type: 'Szkolenie cyfrowe',
      meeting_type: 'Grupowe 10 osób', meetings_count: 6, hours_per_meeting: 6, hour_type: 'dydaktyczne',
      contractor_name: 'ARS', rate_executor: 160, rate_room: 75,
      notes: 'Zadanie 3, wykonawca: Adrian Kocyła' },
    { project_id: pns.id, task_id: T[4],
      code: '4.MID | PnS | Psycholog | 2 | ARS',
      name: 'MID – Psycholog (ARS)', support_type: 'Psycholog',
      meeting_type: 'Indywidualne', meetings_count: 3, hours_per_meeting: 2, hour_type: 'zegarowe',
      contractor_name: 'ARS', rate_executor: 200, rate_room: 50,
      notes: 'Zadanie 4' },
    { project_id: pns.id, task_id: T[4],
      code: '4.MID | PnS | Psycholog | 2 | Pretium',
      name: 'MID – Psycholog (Pretium wolontariat)', support_type: 'Psycholog',
      meeting_type: 'Indywidualne', meetings_count: 3, hours_per_meeting: 2, hour_type: 'zegarowe',
      contractor_name: 'Pretium', rate_executor: 200, rate_room: 50,
      notes: 'Zadanie 4, WOLONTARIAT' },
    { project_id: pns.id, task_id: T[4],
      code: '4.MID | PnS | Prawnik | 1.5 | ARS',
      name: 'MID – Doradztwo prawne (ARS)', support_type: 'Prawnik',
      meeting_type: 'Indywidualne', meetings_count: 2, hours_per_meeting: 1.5, hour_type: 'zegarowe',
      contractor_name: 'ARS', rate_executor: 220, rate_room: 50,
      notes: 'Zadanie 4' },
    { project_id: pns.id, task_id: T[4],
      code: '4.MID | PnS | Doradztwo zawodowe | 1.5 | Educandis',
      name: 'MID – Doradztwo zawodowe (Educandis)', support_type: 'Doradztwo zawodowe',
      meeting_type: 'Indywidualne', meetings_count: 2, hours_per_meeting: 1.5, hour_type: 'zegarowe',
      contractor_name: 'Educandis', rate_executor: 165, rate_room: 50,
      notes: 'Zadanie 4' },
    { project_id: pns.id, task_id: T[5],
      code: '5.Szkolenie | PnS | Szkolenia zawodowe | 0 | Pretium',
      name: 'Szkolenie zawodowe', support_type: 'Szkolenia zawodowe',
      meeting_type: 'Grupowe', meetings_count: 0, hours_per_meeting: 0, hour_type: 'dydaktyczne',
      contractor_name: 'Pretium',
      notes: 'Zadanie 5, wykonawcy: Skillmet / Active Roman Brzezina / Aprender' },
    { project_id: pns.id, task_id: T[6],
      code: '6.Staż | PnS | Staż | 0',
      name: 'Staż zawodowy', support_type: 'Staż',
      meeting_type: 'Indywidualne', meetings_count: 0, hours_per_meeting: 0, hour_type: 'zegarowe',
      notes: 'Zadanie 6, stypendium 1994,40 zł/mc' },
    { project_id: pns.id, task_id: T[7],
      code: '7.PP | PnS | Pośrednictwo pracy | 2 | Educandis',
      name: 'Pośrednictwo pracy (Educandis)', support_type: 'Pośrednictwo pracy',
      meeting_type: 'Indywidualne', meetings_count: 2, hours_per_meeting: 2, hour_type: 'zegarowe',
      contractor_name: 'Educandis', rate_executor: 150,
      notes: 'Zadanie 7, bez sali' },
    { project_id: pns.id, task_id: T[8],
      code: '8.Mentoring | PnS | Mentoring | 2 | ARS',
      name: 'Mentoring (ARS)', support_type: 'Mentoring',
      meeting_type: 'Indywidualne', meetings_count: 1, hours_per_meeting: 2, hour_type: 'zegarowe',
      contractor_name: 'ARS', rate_executor: 170, rate_room: 40,
      notes: 'Zadanie 8' },
  ]

  const { data: sfData, error: sfErr } = await sb.from('support_forms').insert(supportForms).select()
  if (sfErr) { console.error('Błąd support_forms:', sfErr.message); return }
  console.log(`  ✓ ${sfData.length} form wsparcia\n`)

  // ─── 4. Powiąż formy wsparcia z podzadaniami budżetowymi ────────────────────
  console.log('🔗 Łączę formy wsparcia z podzadaniami...')
  const sfLinks = {
    '1.IPD | PnS | Doradztwo zawodowe | 2 | Educandis': ['1.1', '1.3'],
    '1.IPD | PnS | Psycholog | 2 | Educandis':          ['1.2', '1.3'],
    '2.TSK | PnS | TSK | 6 | ARS':                      ['2.1', '2.2'],
    '3.Cyfrowe | PnS | Szkolenie cyfrowe | 6 | ARS':     ['3.1', '3.2'],
    '4.MID | PnS | Psycholog | 2 | ARS':                 ['4.1', '4.3'],
    '4.MID | PnS | Psycholog | 2 | Pretium':             ['4.2', '4.3'],
    '4.MID | PnS | Prawnik | 1.5 | ARS':                 ['4.5', '4.3'],
    '4.MID | PnS | Doradztwo zawodowe | 1.5 | Educandis':['4.7', '4.8', '4.9'],
    '7.PP | PnS | Pośrednictwo pracy | 2 | Educandis':   ['7.1'],
    '8.Mentoring | PnS | Mentoring | 2 | ARS':           ['8.1', '8.2'],
  }

  const linkRows = []
  for (const sf of sfData) {
    const subNumbers = sfLinks[sf.code] || []
    for (const sub of subNumbers) {
      if (BL[sub]) linkRows.push({ support_form_id: sf.id, budget_line_id: BL[sub] })
    }
  }

  if (linkRows.length > 0) {
    const { error: linkErr } = await sb.from('support_form_budget_lines').insert(linkRows)
    if (linkErr) console.error('Błąd links:', linkErr.message)
    else console.log(`  ✓ ${linkRows.length} powiązań\n`)
  }

  // ─── Podsumowanie ─────────────────────────────────────────────────────────
  const totalBudget = budgetLines
    .filter(b => b.budget_type === 'dofinansowanie')
    .reduce((s, b) => s + b.amount_planned, 0)
  const wkladWlasny = budgetLines
    .filter(b => b.budget_type === 'wklad_wlasny')
    .reduce((s, b) => s + b.amount_planned, 0)

  console.log('✅ Seed PnS zakończony!\n')
  console.log('📊 Budżet PnS (podzadania):')
  console.log(`   Dofinansowanie:  ${totalBudget.toLocaleString('pl-PL')} PLN`)
  console.log(`   Wkład własny:    ${wkladWlasny.toLocaleString('pl-PL')} PLN`)
  console.log(`   Łącznie:         ${(totalBudget + wkladWlasny).toLocaleString('pl-PL')} PLN`)
  console.log('\n📋 Formy wsparcia per zadanie:')
  for (const t of tasks) {
    const forms = sfData.filter(sf => sf.task_id === t.id)
    if (forms.length > 0) console.log(`   Zad. ${t.number}: ${forms.map(f => f.support_type).join(', ')}`)
  }
}

run().catch(console.error)
