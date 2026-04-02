// GrantPilot – Seed expenses (wydatki z WNP002 i WNP003)
// node scripts/seed-expenses.mjs

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
  // Pobierz IDs
  const { data: projects } = await sb.from('projects').select('id, project_number')
  const rownosc = projects.find(p => p.project_number === 'FEDS.07.03-IP.02-0039/25')

  const { data: tasks } = await sb.from('tasks').select('id, number').eq('project_id', rownosc.id)
  const t1 = tasks.find(t => t.number === 1)?.id // Kampania
  const t2 = tasks.find(t => t.number === 2)?.id // Konferencje
  const t4 = tasks.find(t => t.number === 4)?.id // Centrum Wsparcia

  const { data: periods } = await sb.from('settlement_periods').select('id, number').eq('project_id', rownosc.id)
  const wnp2 = periods.find(p => p.number === 2)?.id
  const wnp3 = periods.find(p => p.number === 3)?.id

  const { data: orgs } = await sb.from('organizations').select('id, nip, name')
  const pretiumId = orgs.find(o => o.nip === '8971811633')?.id

  // Sprawdź czy wydatki już istnieją
  const { count } = await sb.from('expenses').select('*', { count: 'exact', head: true }).eq('project_id', rownosc.id)
  if (count > 0) {
    console.log(`Wydatki już istnieją (${count}) – czyszczę i wgrywam ponownie`)
    await sb.from('expenses').delete().eq('project_id', rownosc.id)
  }

  const expenses = [
    // ─── WNP002 (wrzesień–listopad 2025) ───────────────────────────────────────
    // Kampania – social media wrzesień, październik, listopad 2025
    { project_id: rownosc.id, task_id: t1, period_id: wnp2, organization_id: pretiumId,
      document_number: '1/09/25', accounting_number: 'FNP4 1/09/25',
      vendor_name: 'PandA spółka cywilna', vendor_nip: '8961644866',
      document_date: '2025-09-29', payment_date: '2025-09-29',
      amount: 1950.00, description: 'Publikacja treści edukacyjnych – wrzesień 2025',
      status: 'settled', notes: 'WNP002' },
    { project_id: rownosc.id, task_id: t1, period_id: wnp2, organization_id: pretiumId,
      document_number: '1/10/25', accounting_number: 'FNP4 1/10/25',
      vendor_name: 'PandA spółka cywilna', vendor_nip: '8961644866',
      document_date: '2025-10-29', payment_date: '2025-10-29',
      amount: 1950.00, description: 'Publikacja treści edukacyjnych – październik 2025',
      status: 'settled', notes: 'WNP002' },
    { project_id: rownosc.id, task_id: t1, period_id: wnp2, organization_id: pretiumId,
      document_number: '1/11/25', accounting_number: 'FNP4 1/11/25',
      vendor_name: 'PandA spółka cywilna', vendor_nip: '8961644866',
      document_date: '2025-11-29', payment_date: '2025-11-29',
      amount: 1950.00, description: 'Publikacja treści edukacyjnych – listopad 2025',
      status: 'settled', notes: 'WNP002' },
    // Konferencja dla kadry oświaty (październik 2025) – szacunek: 82240 - 54900 = 27340
    { project_id: rownosc.id, task_id: t2, period_id: wnp2, organization_id: pretiumId,
      document_number: 'FK-OSWIATA/10/25', accounting_number: 'FNP4 1/10/25K',
      vendor_name: '(do uzupełnienia – konferencja oświata)', vendor_nip: null,
      document_date: '2025-10-31', payment_date: '2025-10-31',
      amount: 27340.00, description: 'Organizacja konferencji dla kadry oświaty – październik 2025',
      status: 'settled', notes: 'WNP002 | SZACUNEK – uzupełnić po odczytaniu PDF' },
    // Pedagodzy listopad 2025
    { project_id: rownosc.id, task_id: t4, period_id: wnp2, organization_id: pretiumId,
      document_number: 'Lista płac 1/11/2025/ETAT', accounting_number: 'LPP4 1/11/25',
      vendor_name: null, vendor_nip: null,
      document_date: '2025-11-30', payment_date: '2025-12-05',
      amount: 7260.00, description: 'Wynagrodzenia – umowa o pracę – listopad 2025',
      status: 'settled', notes: 'WNP002 | SZACUNEK – uzupełnić po odczytaniu PDF' },

    // ─── WNP003 (grudzień 2025–luty 2026) – DANE DOKŁADNE ─────────────────────
    // Zadanie 1 – social media
    { project_id: rownosc.id, task_id: t1, period_id: wnp3, organization_id: pretiumId,
      document_number: '1/12/25', accounting_number: 'FNP4 1/12/25',
      vendor_name: 'PandA spółka cywilna', vendor_nip: '8961644866',
      document_date: '2025-12-29', payment_date: '2025-12-29',
      amount: 1950.00, description: 'Publikacja treści edukacyjnych – grudzień 2025',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t1, period_id: wnp3, organization_id: pretiumId,
      document_number: '1/01/26', accounting_number: 'FNP4 2/01/26',
      vendor_name: 'Patryk Krzyżanowski', vendor_nip: '8862756763',
      document_date: '2026-01-29', payment_date: '2026-01-29',
      amount: 1950.00, description: 'Publikacja treści edukacyjnych – styczeń 2026',
      status: 'settled' },

    // Zadanie 2 – konferencja ochrony zdrowia (Karpacz 15-16.01.2026)
    { project_id: rownosc.id, task_id: t2, period_id: wnp3, organization_id: pretiumId,
      document_number: '0001/01/26/FVS', accounting_number: 'FNP4 1/01/26',
      vendor_name: 'Fundacja Diligo', vendor_nip: '7123485062',
      document_date: '2026-01-16', payment_date: '2026-01-21',
      amount: 14000.00, description: 'Organizacja konferencji – sala | Hotel Dziki Potok Karpacz',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t2, period_id: wnp3, organization_id: pretiumId,
      document_number: '0001/01/26/FVS', accounting_number: 'FNP4 1/01/26',
      vendor_name: 'Fundacja Diligo', vendor_nip: '7123485062',
      document_date: '2026-01-16', payment_date: '2026-01-21',
      amount: 16000.00, description: 'Organizacja konferencji – prelegenci',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t2, period_id: wnp3, organization_id: pretiumId,
      document_number: '0001/01/26/FVS', accounting_number: 'FNP4 1/01/26',
      vendor_name: 'Fundacja Diligo', vendor_nip: '7123485062',
      document_date: '2026-01-16', payment_date: '2026-01-21',
      amount: 7800.00, description: 'Organizacja konferencji – obiad',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t2, period_id: wnp3, organization_id: pretiumId,
      document_number: '0001/01/26/FVS', accounting_number: 'FNP4 1/01/26',
      vendor_name: 'Fundacja Diligo', vendor_nip: '7123485062',
      document_date: '2026-01-16', payment_date: '2026-01-21',
      amount: 4200.00, description: 'Organizacja konferencji – kolacja integracyjna',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t2, period_id: wnp3, organization_id: pretiumId,
      document_number: '0001/01/26/FVS', accounting_number: 'FNP4 1/01/26',
      vendor_name: 'Fundacja Diligo', vendor_nip: '7123485062',
      document_date: '2026-01-16', payment_date: '2026-01-21',
      amount: 12900.00, description: 'Organizacja konferencji – nocleg ze śniadaniem',
      status: 'settled' },

    // Zadanie 4 – pedagodzy (październik 2025 – pominięty w WNP002, doliczone do WNP003)
    { project_id: rownosc.id, task_id: t4, period_id: wnp3, organization_id: pretiumId,
      document_number: 'Lista płac 5/10/2025/ETAT', accounting_number: 'LPP4 1/10/25',
      document_date: '2025-10-31', payment_date: '2025-11-05',
      amount: 15295.12, description: 'Wynagrodzenia – umowa o pracę – październik 2025 (pominięte w WNP002)',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t4, period_id: wnp3, organization_id: pretiumId,
      document_number: 'Lista płac 1/12/2025/ETAT', accounting_number: 'LPP4 1/12/25',
      document_date: '2025-12-31', payment_date: '2026-01-07',
      amount: 12142.73, description: 'Wynagrodzenia – umowa o pracę – grudzień 2025 (cz. I)',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t4, period_id: wnp3, organization_id: pretiumId,
      document_number: 'Lista płac 1/12/2025/ETAT', accounting_number: 'LPP4 2/12/25',
      document_date: '2025-12-31', payment_date: '2026-01-08',
      amount: 833.06, description: 'Wynagrodzenia – umowa o pracę – grudzień 2025 (cz. II)',
      status: 'settled' },
    { project_id: rownosc.id, task_id: t4, period_id: wnp3, organization_id: pretiumId,
      document_number: 'Lista płac 1/01/2026/ETAT', accounting_number: 'LPP4 1/01/26',
      document_date: '2026-01-30', payment_date: '2026-02-04',
      amount: 12451.00, description: 'Wynagrodzenia – umowa o pracę – styczeń 2026',
      status: 'settled' },

    // Zadanie 4 – psycholog
    { project_id: rownosc.id, task_id: t4, period_id: wnp3, organization_id: pretiumId,
      document_number: '0002/01/26/FVS', accounting_number: 'FNP4 3/01/26',
      vendor_name: 'Fundacja Diligo', vendor_nip: '7123485062',
      document_date: '2026-01-30', payment_date: '2026-02-04',
      amount: 880.00, description: 'Wsparcie psychologiczne – interwencja kryzysowa – styczeń 2026 (4h × 220 zł)',
      status: 'settled' },
  ]

  const { data, error } = await sb.from('expenses').insert(expenses).select()
  if (error) { console.error('Błąd:', error.message); return }
  console.log(`✓ Wgrano ${data.length} wydatków`)

  // Sumy
  const wnp2sum = expenses.filter(e => e.period_id === wnp2).reduce((s, e) => s + e.amount, 0)
  const wnp3sum = expenses.filter(e => e.period_id === wnp3).reduce((s, e) => s + e.amount, 0)
  console.log(`  WNP002: ${wnp2sum.toFixed(2)} zł`)
  console.log(`  WNP003: ${wnp3sum.toFixed(2)} zł`)
  console.log(`  Łącznie: ${(wnp2sum + wnp3sum).toFixed(2)} zł`)

  // Zaktualizuj total_claimed w settlement_periods
  await sb.from('settlement_periods').update({ total_claimed: wnp2sum }).eq('id', wnp2)
  await sb.from('settlement_periods').update({ total_claimed: wnp3sum }).eq('id', wnp3)
  console.log('✓ Zaktualizowano total_claimed w WNP')
}

run().catch(console.error)
