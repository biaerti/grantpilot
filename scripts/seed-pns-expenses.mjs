// GrantPilot – Seed expenses PnS (WNP003, WNP004, WNP005)
// node scripts/seed-pns-expenses.mjs
//
// WNP003: 2025-06-01 – 2025-08-31, razem 1 440,00 zł
// WNP004: 2025-09-01 – 2025-11-30, razem 120 212,09 zł
// WNP005: 2025-12-01 – 2026-01-31, razem 219 276,16 zł

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
  const { data: projects } = await sb.from('projects').select('id, project_number')
  const pns = projects.find(p => p.project_number === 'FEDS.07.05-IP.02-0172/24')
  if (!pns) { console.error('Projekt PnS nie znaleziony!'); return }
  console.log('PnS project id:', pns.id)

  const { data: tasks } = await sb.from('tasks').select('id, number').eq('project_id', pns.id).order('number')
  const T = {}
  tasks.forEach(t => T[t.number] = t.id)
  console.log('Tasks:', Object.keys(T).map(k => `Zad.${k}=${T[k].slice(0,8)}`).join(', '))

  // Okresy rozliczeniowe – utwórz jeśli nie istnieją
  const { data: existingPeriods } = await sb.from('settlement_periods').select('id, number').eq('project_id', pns.id)
  const periodMap = {}
  existingPeriods?.forEach(p => periodMap[p.number] = p.id)

  const periodsToCreate = [
    { number: 1, period_start: '2024-10-01', period_end: '2025-05-31', status: 'approved', advance_received: true, advance_amount: 800000, total_claimed: 0 },
    { number: 3, period_start: '2025-06-01', period_end: '2025-08-31', status: 'approved', advance_received: false, advance_amount: 0, total_claimed: 1440 },
    { number: 4, period_start: '2025-09-01', period_end: '2025-11-30', status: 'approved', advance_received: false, advance_amount: 0, total_claimed: 120212.09 },
    { number: 5, period_start: '2025-12-01', period_end: '2026-01-31', status: 'submitted', advance_received: false, advance_amount: 0, total_claimed: 219276.16 },
  ]

  for (const p of periodsToCreate) {
    if (!periodMap[p.number]) {
      const { data: created, error } = await sb.from('settlement_periods').insert({ ...p, project_id: pns.id }).select().single()
      if (error) { console.error(`Błąd tworzenia okresu ${p.number}:`, error.message); continue }
      periodMap[p.number] = created.id
      console.log(`Utworzono okres WNP00${p.number}`)
    } else {
      // Zaktualizuj total_claimed
      await sb.from('settlement_periods').update({ total_claimed: p.total_claimed, status: p.status }).eq('id', periodMap[p.number])
      console.log(`Zaktualizowano okres WNP00${p.number}`)
    }
  }

  // Pobierz organizacje
  const { data: orgs } = await sb.from('organizations').select('id, nip, name')
  const orgByNip = {}
  orgs?.forEach(o => orgByNip[o.nip] = o.id)

  // Utwórz brakujące organizacje
  const orgsNeeded = [
    { nip: '8971811633', name: 'Fundacja Pretium', type: 'own' },
    { nip: '8982314157', name: 'Educandis sp. z o.o.', type: 'external' },
    { nip: '8942357686', name: 'Fundacja Ars Auxiliumd', type: 'external' },
    { nip: '5260207864', name: 'Firma cateringowa (ARS)', type: 'external' },
    { nip: '8943186034', name: 'Organizacja stażowa (ARS)', type: 'external' },
    { nip: '5751842481', name: 'Trener cyfrowy (ARS)', type: 'external' },
    { nip: '8862614543', name: 'Kancelaria prawna (ARS)', type: 'external' },
    { nip: '5850001690', name: 'Ubezpieczyciel NNW', type: 'external' },
  ]
  for (const o of orgsNeeded) {
    if (!orgByNip[o.nip]) {
      const { data: created } = await sb.from('organizations').insert(o).select().single()
      orgByNip[o.nip] = created?.id
      console.log(`Org: ${o.name}`)
    }
  }

  const pretium = orgByNip['8971811633']
  const educandis = orgByNip['8982314157']
  const ars = orgByNip['8942357686']
  const catering = orgByNip['5260207864']
  const stazowa = orgByNip['8943186034']
  const trenerCyf = orgByNip['5751842481']
  const prawna = orgByNip['8862614543']
  const ubezp = orgByNip['5850001690']

  // Wyczyść stare wydatki PnS
  const { count } = await sb.from('expenses').select('*', { count: 'exact', head: true }).eq('project_id', pns.id)
  if (count > 0) {
    console.log(`Czyszczę ${count} starych wydatków PnS...`)
    await sb.from('expenses').delete().eq('project_id', pns.id)
  }

  const wnp3 = periodMap[3]
  const wnp4 = periodMap[4]
  const wnp5 = periodMap[5]

  const expenses = [
    // ══════════════════════════════════════════════════════════
    // WNP003 (czerwiec–sierpień 2025): 1 200,00 bezpośrednie + 240,00 pośrednie
    // ══════════════════════════════════════════════════════════
    {
      project_id: pns.id, task_id: T[1], period_id: wnp3,
      organization_id: educandis,
      document_number: 'FV 7/2025', accounting_number: 'FZP2 1/06/25',
      vendor_name: 'Educandis sp. z o.o.', vendor_nip: '8982314157',
      document_date: '2025-06-09', payment_date: '2025-06-12',
      amount: 1200.00,
      description: 'Diagnoza sytuacji problemowej – psycholog (3 osoby IPD, maj 2025)',
      status: 'settled', notes: 'WNP003 poz.1.2 / wkład własny'
    },
    // Koszty pośrednie WNP003 (20% × 1200)
    {
      project_id: pns.id, task_id: null, period_id: wnp3,
      organization_id: pretium,
      document_number: 'KP-WNP003', accounting_number: 'KP-WNP003',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-08-31', payment_date: '2025-08-31',
      amount: 240.00,
      description: 'Koszty pośrednie – stawka ryczałtowa 20% od kosztów bezpośrednich WNP003',
      status: 'settled', notes: 'WNP003 koszty pośrednie'
    },

    // ══════════════════════════════════════════════════════════
    // WNP004 (wrzesień–listopad 2025): 100 176,74 bezpośrednie + 20 035,35 pośrednie
    // ══════════════════════════════════════════════════════════

    // Zad.1 – 1 320,00 zł (doradca zawodowy)
    {
      project_id: pns.id, task_id: T[1], period_id: wnp4,
      organization_id: educandis,
      document_number: '0006/10/25/FVS', accounting_number: 'FNP3 2/10/25',
      vendor_name: 'Centrum Edukacji i Rozwoju PSA', vendor_nip: '8982314157',
      document_date: '2025-10-31', payment_date: '2025-11-13',
      amount: 1320.00,
      description: 'Wynagrodzenie doradców zawodowych – IPD (8h, październik 2025)',
      status: 'settled', notes: 'WNP004 poz.1.1 / tryb poniżej zasady konkurencyjności'
    },

    // Zad.2 – 10 244,59 zł
    {
      project_id: pns.id, task_id: T[2], period_id: wnp4,
      organization_id: ars,
      document_number: 'FV2025/09/1', accounting_number: 'P02-11',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2025-09-02', payment_date: '2025-09-05',
      amount: 6120.00,
      description: 'Wynagrodzenie trenerów – grupowe treningi kompetencji społecznych 36h (gr.1)',
      status: 'settled', notes: 'WNP004 poz.2.1'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp4,
      organization_id: catering,
      document_number: 'F/25-09/0408', accounting_number: 'P02-12',
      vendor_name: 'Catering – ARS', vendor_nip: '5260207864',
      document_date: '2025-09-12', payment_date: '2025-09-12',
      amount: 1424.59,
      description: 'Catering podczas treningu kompetencji społecznych (gr.1)',
      status: 'settled', notes: 'WNP004 poz.2.4 / 98,93% realizacji pozycji'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp4,
      organization_id: ars,
      document_number: 'FV2025/09/2', accounting_number: 'P02-14',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2025-10-14', payment_date: '2025-10-14',
      amount: 2700.00,
      description: 'Wynajem sali – treningi kompetencji społecznych 36h × 80 zł (gr.1)',
      status: 'settled', notes: 'WNP004 poz.2.2'
    },

    // Zad.3 – 22 285,28 zł
    {
      project_id: pns.id, task_id: T[3], period_id: wnp4,
      organization_id: ars,
      document_number: 'FV2025/09/3', accounting_number: 'P02-13',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2025-10-14', payment_date: '2025-10-14',
      amount: 5760.00,
      description: 'Wynagrodzenie trenera – szkolenie cyfrowe 36h (gr.1)',
      status: 'settled', notes: 'WNP004 poz.3.1'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp4,
      organization_id: ars,
      document_number: 'FV2025/10/1', accounting_number: 'P02-17',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2025-10-31', payment_date: '2025-11-10',
      amount: 2700.00,
      description: 'Opłata za egzaminy ECCC 3 moduły DIGCOMP (gr.1, 15UP)',
      status: 'settled', notes: 'WNP004 poz.3.3'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp4,
      organization_id: stazowa,
      document_number: 'DW/11/2025', accounting_number: 'P02-18',
      vendor_name: 'ARS Auxiliumd (stypendia)', vendor_nip: '8943186034',
      document_date: '2025-11-15', payment_date: '2025-11-30',
      amount: 8600.00,
      description: 'Stypendia szkoleniowe – szkolenie cyfrowe gr.1 (staż ryczałt)',
      status: 'settled', notes: 'WNP004 poz.3.7 (część)'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp4,
      organization_id: stazowa,
      document_number: 'DW/10/2025', accounting_number: 'P02-16',
      vendor_name: 'ARS Auxiliumd (stypendia)', vendor_nip: '8943186034',
      document_date: '2025-10-25', payment_date: '2025-10-31',
      amount: 2700.00,
      description: 'Catering podczas szkoleń cyfrowych (gr.1)',
      status: 'settled', notes: 'WNP004 poz.3.5'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp4,
      organization_id: ars,
      document_number: 'WW/01/2025/CYF', accounting_number: 'WW/01/2025/CYF',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2025-11-30', payment_date: '2025-11-30',
      amount: 2525.28,
      description: 'Wynajem sali komputerowej – szkolenie cyfrowe',
      status: 'settled', notes: 'WNP004 poz.3.2 (część)'
    },

    // Zad.5 – 37 015,78 zł (szkolenia zawodowe + stypendia)
    {
      project_id: pns.id, task_id: T[5], period_id: wnp4,
      organization_id: pretium,
      document_number: 'FV5/PNS/2025', accounting_number: 'FNP3 1/09/25',
      vendor_name: 'Skillmet / Active Roman Brzezina', vendor_nip: '8971811633',
      document_date: '2025-09-30', payment_date: '2025-10-15',
      amount: 20900.00,
      description: 'Szkolenie zawodowe – Profesjonalna Sprzedaż DISK 110h (8 UP)',
      status: 'settled', notes: 'WNP004 poz.5.1'
    },
    {
      project_id: pns.id, task_id: T[5], period_id: wnp4,
      organization_id: pretium,
      document_number: 'FNP3 2/09/25', accounting_number: 'FNP3 2/09/25',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-11-15', payment_date: '2025-11-30',
      amount: 10623.96,
      description: 'Składki ZUS od stypendiów szkoleniowych (październik 2025)',
      status: 'settled', notes: 'WNP004 poz.5.4'
    },
    {
      project_id: pns.id, task_id: T[5], period_id: wnp4,
      organization_id: pretium,
      document_number: 'FNP3 3/10/25', accounting_number: 'FNP3 3/10/25',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-11-30', payment_date: '2025-11-30',
      amount: 5491.82,
      description: 'Stypendia szkoleniowe – szkolenie zawodowe (8 UP × pozostałe h)',
      status: 'settled', notes: 'WNP004 poz.5.3 (część)'
    },

    // Zad.6 – staże 28 307,09 zł
    {
      project_id: pns.id, task_id: T[6], period_id: wnp4,
      organization_id: pretium,
      document_number: 'LPP3 1/09/25', accounting_number: 'LPP3 1/09/25',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-09-30', payment_date: '2025-10-10',
      amount: 9130.00,
      description: 'Stypendia stażowe – wrzesień 2025',
      status: 'settled', notes: 'WNP004 poz.6.1'
    },
    {
      project_id: pns.id, task_id: T[6], period_id: wnp4,
      organization_id: pretium,
      document_number: 'LPP3 1/10/25', accounting_number: 'LPP3 1/10/25',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-10-31', payment_date: '2025-11-10',
      amount: 9807.09,
      description: 'Stypendia stażowe – październik 2025',
      status: 'settled', notes: 'WNP004 poz.6.1'
    },
    {
      project_id: pns.id, task_id: T[6], period_id: wnp4,
      organization_id: pretium,
      document_number: 'LPP3 1/11/25', accounting_number: 'LPP3 1/11/25',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-11-30', payment_date: '2025-12-05',
      amount: 9370.00,
      description: 'Stypendia stażowe – listopad 2025',
      status: 'settled', notes: 'WNP004 poz.6.1'
    },

    // Koszty pośrednie WNP004 (20% × 100 176,74)
    {
      project_id: pns.id, task_id: null, period_id: wnp4,
      organization_id: pretium,
      document_number: 'KP-WNP004', accounting_number: 'KP-WNP004',
      vendor_name: 'Fundacja Pretium',
      document_date: '2025-11-30', payment_date: '2025-11-30',
      amount: 20035.35,
      description: 'Koszty pośrednie – stawka ryczałtowa 20% od kosztów bezpośrednich WNP004',
      status: 'settled', notes: 'WNP004 koszty pośrednie'
    },

    // ══════════════════════════════════════════════════════════
    // WNP005 (grudzień 2025 – styczeń 2026): 182 730,13 + 36 546,03 pośrednie
    // ══════════════════════════════════════════════════════════

    // Zad.1 – 14 060,00 zł
    {
      project_id: pns.id, task_id: T[1], period_id: wnp5,
      organization_id: educandis,
      document_number: '0010/11/25/FVS', accounting_number: 'FNP2 1/11/25',
      vendor_name: 'Educandis sp. z o.o.', vendor_nip: '8982314157',
      document_date: '2025-11-30', payment_date: '2026-01-21',
      amount: 1980.00,
      description: 'Diagnoza – doradca zawodowy 12h (XI 2025)',
      status: 'settled', notes: 'WNP005 poz.1.1'
    },
    {
      project_id: pns.id, task_id: T[1], period_id: wnp5,
      organization_id: educandis,
      document_number: '0025/12/25/FVS', accounting_number: 'FNP2 1/12/25',
      vendor_name: 'Educandis sp. z o.o.', vendor_nip: '8982314157',
      document_date: '2025-12-31', payment_date: '2026-01-21',
      amount: 3960.00,
      description: 'Diagnoza – doradca zawodowy 24h (XII 2025)',
      status: 'settled', notes: 'WNP005 poz.1.1'
    },
    {
      project_id: pns.id, task_id: T[1], period_id: wnp5,
      organization_id: educandis,
      document_number: 'WW/01/2025/SAL', accounting_number: 'WW/01/2025/SAL',
      vendor_name: 'Educandis sp. z o.o.', vendor_nip: '8971811633',
      document_date: '2025-12-15', payment_date: '2025-12-15',
      amount: 6800.00,
      description: 'Udostępnienie sal – diagnoza IPD (34 UP × 4h × 50 zł)',
      status: 'settled', notes: 'WNP005 poz.1.3 wkład niepienięzny'
    },
    {
      project_id: pns.id, task_id: T[1], period_id: wnp5,
      organization_id: educandis,
      document_number: '0011/11/25/FVS', accounting_number: 'FNP2 1/10/25',
      vendor_name: 'Educandis sp. z o.o.', vendor_nip: '8982314157',
      document_date: '2025-11-28', payment_date: '2026-01-27',
      amount: 1320.00,
      description: 'Indywidualne poradnictwo zawodowe 8h (październik 2025)',
      status: 'settled', notes: 'WNP005 poz.1.1 (korekta)'
    },

    // Zad.2 – 37 305,00 zł
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: ars,
      document_number: 'FV2025/12/1', accounting_number: 'P02-16',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2025-12-10', payment_date: '2025-12-10',
      amount: 6120.00,
      description: 'Wynagrodzenie trenera – treningi kompetencji społecznych (gr.2, 3 tematy × 12h)',
      status: 'settled', notes: 'WNP005 poz.2.1'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: ars,
      document_number: 'FV2026/01/3', accounting_number: 'P02-30',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2026-01-19', payment_date: '2026-01-19',
      amount: 6120.00,
      description: 'Wynagrodzenie trenera – treningi kompetencji społecznych (gr.3)',
      status: 'settled', notes: 'WNP005 poz.2.1'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: ars,
      document_number: 'FV2026/01/4', accounting_number: 'P02-31',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2026-01-19', payment_date: '2026-01-19',
      amount: 6120.00,
      description: 'Wynagrodzenie trenera – treningi kompetencji społecznych (gr.4)',
      status: 'settled', notes: 'WNP005 poz.2.1'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: stazowa,
      document_number: 'DW/02/01/2026', accounting_number: 'P02-33',
      vendor_name: 'ARS Auxiliumd (wynajem)', vendor_nip: '8943186034',
      document_date: '2026-01-31', payment_date: '2026-01-31',
      amount: 11520.00,
      description: 'Wynajem sali – treningi kompetencji społecznych (gr.2-4)',
      status: 'settled', notes: 'WNP005 poz.2.2'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: catering,
      document_number: 'F/25-11/0553', accounting_number: 'P02-15',
      vendor_name: 'Catering ARS', vendor_nip: '5260207864',
      document_date: '2025-11-30', payment_date: '2025-12-14',
      amount: 2835.00,
      description: 'Catering treningi 13-22.11.2025 (63 szt.)',
      status: 'settled', notes: 'WNP005 poz.2.4'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: catering,
      document_number: 'F/26-01/0065', accounting_number: 'P02-29',
      vendor_name: 'Catering ARS', vendor_nip: '5260207864',
      document_date: '2026-01-12', payment_date: '2026-01-19',
      amount: 2160.00,
      description: 'Catering treningi 17-23.12.2025 (gr.2, 48 szt.)',
      status: 'settled', notes: 'WNP005 poz.2.4'
    },
    {
      project_id: pns.id, task_id: T[2], period_id: wnp5,
      organization_id: catering,
      document_number: 'F/26-01/0064', accounting_number: 'P02-28',
      vendor_name: 'Catering ARS', vendor_nip: '5260207864',
      document_date: '2026-01-12', payment_date: '2026-01-19',
      amount: 2430.00,
      description: 'Catering treningi 17-23.12.2025 (gr.3, 54 szt.)',
      status: 'settled', notes: 'WNP005 poz.2.4'
    },

    // Zad.3 – 21 095,94 zł
    {
      project_id: pns.id, task_id: T[3], period_id: wnp5,
      organization_id: ars,
      document_number: 'FV2025/12/CYF', accounting_number: 'P02-26',
      vendor_name: 'Trener cyfrowy', vendor_nip: '5751842481',
      document_date: '2025-12-17', payment_date: '2025-12-13',
      amount: 5760.00,
      description: 'Wynagrodzenie trenera – szkolenie cyfrowe 36h (gr.2)',
      status: 'settled', notes: 'WNP005 poz.3.1'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp5,
      organization_id: ars,
      document_number: 'FV2026/01/CYF', accounting_number: 'P02-35',
      vendor_name: 'Fundacja Ars Auxiliumd', vendor_nip: '8942357686',
      document_date: '2026-01-31', payment_date: '2026-01-31',
      amount: 2970.00,
      description: 'Catering szkolenie cyfrowe (gr.2)',
      status: 'settled', notes: 'WNP005 poz.3.5'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp5,
      organization_id: stazowa,
      document_number: 'DW/12/2025/CYF', accounting_number: 'P02-20-24',
      vendor_name: 'ARS Auxiliumd (stypendia)', vendor_nip: '8943186034',
      document_date: '2025-12-19', payment_date: '2025-12-19',
      amount: 4484.62,
      description: 'Stypendia szkoleniowe – szkolenie cyfrowe gr.2 (7 UP × 640,66)',
      status: 'settled', notes: 'WNP005 poz.3.7'
    },
    {
      project_id: pns.id, task_id: T[3], period_id: wnp5,
      organization_id: stazowa,
      document_number: 'DW/01/2026/CYF', accounting_number: 'P02-36',
      vendor_name: 'ARS Auxiliumd (stypendia)', vendor_nip: '8943186034',
      document_date: '2026-01-31', payment_date: '2026-01-31',
      amount: 7881.32,
      description: 'Stypendia szkoleniowe – szkolenie cyfrowe gr.2 (część ZUS)',
      status: 'settled', notes: 'WNP005 poz.3.7 ZUS'
    },

    // Zad.4 – 26 685,00 zł
    {
      project_id: pns.id, task_id: T[4], period_id: wnp5,
      organization_id: ars,
      document_number: 'P02-32', accounting_number: 'P02-32',
      vendor_name: 'Kancelaria prawna', vendor_nip: '8862614543',
      document_date: '2026-01-16', payment_date: '2026-01-20',
      amount: 9240.00,
      description: 'Wynagrodzenie prawnika – indywidualne poradnictwo prawne',
      status: 'settled', notes: 'WNP005 poz.4.5'
    },
    {
      project_id: pns.id, task_id: T[4], period_id: wnp5,
      organization_id: educandis,
      document_number: 'FNP2 2/12/25', accounting_number: 'FNP2 2/12/25',
      vendor_name: 'Educandis sp. z o.o.', vendor_nip: '8982314157',
      document_date: '2025-12-31', payment_date: '2026-01-21',
      amount: 5445.00,
      description: 'Wynagrodzenie doradców zawodowych 33h – poradnictwo zawodowe (XII 2025)',
      status: 'settled', notes: 'WNP005 poz.4.7'
    },
    {
      project_id: pns.id, task_id: T[4], period_id: wnp5,
      organization_id: pretium,
      document_number: 'WW/02/2025/PSYCH', accounting_number: 'WW/02/2025/PSYCH',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-12-30', payment_date: '2025-12-30',
      amount: 6000.00,
      description: 'Wynagrodzenie psychologów – indywidualne poradnictwo psychologiczne',
      status: 'settled', notes: 'WNP005 poz.4.2'
    },
    {
      project_id: pns.id, task_id: T[4], period_id: wnp5,
      organization_id: pretium,
      document_number: 'WW/03/2025/PSYCH', accounting_number: 'WW/03/2025/PSYCH',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-12-30', payment_date: '2025-12-30',
      amount: 6000.00,
      description: 'Wynagrodzenie psychologów – indywidualne poradnictwo psychologiczne (część 2)',
      status: 'settled', notes: 'WNP005 poz.4.2'
    },

    // Zad.5 – 37 892,18 zł (szkolenia zawodowe)
    {
      project_id: pns.id, task_id: T[5], period_id: wnp5,
      organization_id: pretium,
      document_number: 'FNP3 3/10/25', accounting_number: 'FNP3 3/10/25',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-10-31', payment_date: '2025-11-18',
      amount: 10623.96,
      description: 'Składki ZUS – stypendia szkoleniowe (szkolenie zawodowe)',
      status: 'settled', notes: 'WNP005 poz.5.4'
    },
    {
      project_id: pns.id, task_id: T[5], period_id: wnp5,
      organization_id: pretium,
      document_number: 'FNP3 1/01/26', accounting_number: 'FNP3 1/01/26',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2026-01-31', payment_date: '2026-01-31',
      amount: 27268.22,
      description: 'Stypendia szkoleniowe – szkolenie zawodowe (styczeń 2026)',
      status: 'settled', notes: 'WNP005 poz.5.3'
    },

    // Zad.6 – staże 32 003,87 zł
    {
      project_id: pns.id, task_id: T[6], period_id: wnp5,
      organization_id: pretium,
      document_number: 'LPP3 1/10/25', accounting_number: 'LPP3 1/10/25',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-10-31', payment_date: '2025-12-11',
      amount: 6138.30,
      description: 'Składki ZUS – stypendia stażowe (październik 2025)',
      status: 'settled', notes: 'WNP005 poz.6.2'
    },
    {
      project_id: pns.id, task_id: T[6], period_id: wnp5,
      organization_id: pretium,
      document_number: 'LPP3 1/11/25', accounting_number: 'LPP3 1/11/25',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-11-30', payment_date: '2025-12-06',
      amount: 9325.49,
      description: 'Stypendia stażowe – listopad 2025',
      status: 'settled', notes: 'WNP005 poz.6.1'
    },
    {
      project_id: pns.id, task_id: T[6], period_id: wnp5,
      organization_id: pretium,
      document_number: 'LPP3 2/11/25', accounting_number: 'LPP3 2/11/25',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-11-30', payment_date: '2025-12-11',
      amount: 3251.80,
      description: 'Składki ZUS – stypendia stażowe (listopad 2025)',
      status: 'settled', notes: 'WNP005 poz.6.2'
    },
    {
      project_id: pns.id, task_id: T[6], period_id: wnp5,
      organization_id: pretium,
      document_number: 'LPP3 1/12/25', accounting_number: 'LPP3 1/12/25',
      vendor_name: 'Fundacja Pretium', vendor_nip: '8971811633',
      document_date: '2025-12-31', payment_date: '2026-01-08',
      amount: 16290.08,
      description: 'Stypendia stażowe – grudzień 2025',
      status: 'settled', notes: 'WNP005 poz.6.1'
    },
    {
      project_id: pns.id, task_id: T[6], period_id: wnp5,
      organization_id: ubezp,
      document_number: 'PKP3 1/12/25', accounting_number: 'PKP3 1/12/25',
      vendor_name: 'Ubezpieczyciel NNW', vendor_nip: '5850001690',
      document_date: '2025-12-17', payment_date: '2025-12-20',
      amount: 250.00,
      description: 'Polisa ubezpieczenia NNW na staż',
      status: 'settled', notes: 'WNP005 poz.6.4'
    },

    // Koszty pośrednie WNP005 (20% × 182 730,13 = 36 546,03)
    {
      project_id: pns.id, task_id: null, period_id: wnp5,
      organization_id: pretium,
      document_number: 'KP-WNP005', accounting_number: 'KP-WNP005',
      vendor_name: 'Fundacja Pretium',
      document_date: '2026-01-31', payment_date: '2026-01-31',
      amount: 36546.03,
      description: 'Koszty pośrednie – stawka ryczałtowa 20% od kosztów bezpośrednich WNP005',
      status: 'settled', notes: 'WNP005 koszty pośrednie'
    },
  ]

  // Wgraj wydatki
  const { error } = await sb.from('expenses').insert(expenses)
  if (error) {
    console.error('Błąd wgrywania wydatków:', error.message)
    return
  }
  console.log(`\nWgrano ${expenses.length} wydatków PnS!`)

  // Podsumowanie
  const directWnp3 = expenses.filter(e => e.period_id === wnp3 && !e.notes?.includes('pośrednie')).reduce((s, e) => s + e.amount, 0)
  const directWnp4 = expenses.filter(e => e.period_id === wnp4 && !e.notes?.includes('pośrednie')).reduce((s, e) => s + e.amount, 0)
  const directWnp5 = expenses.filter(e => e.period_id === wnp5 && !e.notes?.includes('pośrednie')).reduce((s, e) => s + e.amount, 0)
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  console.log(`\nWNP003 bezpośrednie: ${directWnp3.toFixed(2)} zł (wniosek: 1 200,00 zł)`)
  console.log(`WNP004 bezpośrednie: ${directWnp4.toFixed(2)} zł (wniosek: 100 176,74 zł)`)
  console.log(`WNP005 bezpośrednie: ${directWnp5.toFixed(2)} zł (wniosek: 182 730,13 zł)`)
  console.log(`Razem wszystkie: ${total.toFixed(2)} zł`)
  console.log(`Łącznie rozliczone: 1440 + 120 212,09 + 219 276,16 = 340 928,25 zł`)
}

run().catch(console.error)
