// Poprawia budżety zadań PnS i wgrywa poprawne wydatki narastająco z WNP005
// node scripts/fix-pns-budgets.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pkswbzifdhdgavpccfpu.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrc3diemlmZGhkZ2F2cGNjZnB1Iiwicm9sZSI6' +
  'InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA0MjI2NCwiZXhwIjoyMDkwNjE4MjY0fQ' +
  '.VbSFWmoAUY024ShxTOQUs5QGLVEpCsoAOT99iudMOtA'

const sb = createClient(SUPABASE_URL, SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Dane z WNP005 podsumowanie – wydatki w projekcie (budżet) i narastająco (faktycznie wydane)
const TASK_DATA = [
  { number: 1, name: 'Diagnoza sytuacji problemowej i opracowanie IPD',         budget: 75600.00,    spent: 16580.00 },
  { number: 2, name: 'Treningi umiejętności społecznych',                        budget: 98640.00,    spent: 47549.59 },
  { number: 3, name: 'Szkolenia podnoszące kompetencje cyfrowe',                 budget: 183155.20,   spent: 43381.22 },
  { number: 4, name: 'Indywidualne poradnictwo psychologiczne, prawne i zawodowe', budget: 200820.00, spent: 26685.00 },
  { number: 5, name: 'Szkolenia zawodowe',                                       budget: 369096.00,   spent: 121524.09 },
  { number: 6, name: 'Staże',                                                    budget: 745029.36,   spent: 28386.97 },
  { number: 7, name: 'Indywidualne pośrednictwo pracy',                          budget: 49800.00,    spent: 0 },
  { number: 8, name: 'Indywidualny mentoring',                                   budget: 17600.00,    spent: 0 },
]
// Łącznie bezpośrednie: 1 739 740,56 zł
// Koszty pośrednie 20%: 347 948,11 zł
// RAZEM projekt: 2 087 688,67 zł

async function run() {
  const { data: projects } = await sb.from('projects').select('id, project_number')
  const pns = projects.find(p => p.project_number === 'FEDS.07.05-IP.02-0172/24')
  console.log('PnS:', pns.id)

  // 1. Zaktualizuj budżety zadań
  const { data: tasks } = await sb.from('tasks').select('id, number, name').eq('project_id', pns.id).order('number')

  for (const td of TASK_DATA) {
    const task = tasks.find(t => t.number === td.number)
    if (!task) { console.warn(`Nie znaleziono zadania ${td.number}`); continue }
    const indirect = td.budget * 0.2
    const { error } = await sb.from('tasks').update({
      name: td.name,
      budget_direct: td.budget,
      budget_indirect: indirect,
    }).eq('id', task.id)
    if (error) console.error(`Błąd zad.${td.number}:`, error.message)
    else console.log(`Zad.${td.number} budżet: ${td.budget.toLocaleString('pl')} zł, pośrednie: ${indirect.toLocaleString('pl')} zł`)
  }

  // 2. Zaktualizuj projekt – total_budget
  const totalDirect = TASK_DATA.reduce((s, t) => s + t.budget, 0)
  const totalIndirect = totalDirect * 0.2
  const totalBudget = totalDirect + totalIndirect
  await sb.from('projects').update({
    total_budget: totalBudget,
    grant_amount: 1981848.67,  // dofinansowanie z WNP005 strona 41
  }).eq('id', pns.id)
  console.log(`\nBudżet projektu: ${totalBudget.toLocaleString('pl')} zł`)

  // 3. Wyczyść stare wydatki i wgraj poprawne – wydatki narastająco jako jeden rekord per zadanie
  // (odzwierciedla stan na 31.01.2026 z WNP005)
  await sb.from('expenses').delete().eq('project_id', pns.id)
  console.log('Wyczyszczono stare wydatki')

  const { data: tasksRefreshed } = await sb.from('tasks').select('id, number').eq('project_id', pns.id).order('number')
  const T = {}
  tasksRefreshed.forEach(t => T[t.number] = t.id)

  const { data: periods } = await sb.from('settlement_periods').select('id, number').eq('project_id', pns.id)
  const periodMap = {}
  periods?.forEach(p => periodMap[p.number] = p.id)

  const { data: orgs } = await sb.from('organizations').select('id, nip')
  const orgByNip = {}
  orgs?.forEach(o => orgByNip[o.nip] = o.id)
  const pretium = orgByNip['8971811633']

  // Wgrywamy po jednym rekordzie per zadanie "wydatki narastająco do WNP005"
  // Łączone z WNP003+WNP004+WNP005
  const expenses = TASK_DATA
    .filter(td => td.spent > 0)
    .map(td => ({
      project_id: pns.id,
      task_id: T[td.number],
      period_id: periodMap[5] ?? null,  // przypisz do WNP005 jako ostatniego
      organization_id: pretium,
      document_number: `SUMA-WNP003-WNP005-ZAD${td.number}`,
      accounting_number: `SUMA-ZAD${td.number}`,
      vendor_name: 'Wydatki łączne WNP003–WNP005',
      document_date: '2026-01-31',
      payment_date: '2026-01-31',
      amount: td.spent,
      description: `${td.name} – wydatki narastająco WNP003–WNP005`,
      status: 'settled',
      notes: `Narastająco wg WNP005 str.32-40: ${td.spent} zł / budżet: ${td.budget} zł`,
    }))

  // Koszty pośrednie łącznie
  expenses.push({
    project_id: pns.id,
    task_id: null,
    period_id: periodMap[5] ?? null,
    organization_id: pretium,
    document_number: 'KP-SUMA-WNP003-WNP005',
    accounting_number: 'KP-SUMA',
    vendor_name: 'Fundacja Pretium',
    document_date: '2026-01-31',
    payment_date: '2026-01-31',
    amount: 56821.38,
    description: 'Koszty pośrednie narastająco WNP003–WNP005 (20% od kosztów bezpośrednich)',
    status: 'settled',
    notes: 'Koszty pośrednie łączne wg WNP005',
  })

  const { error: expErr } = await sb.from('expenses').insert(expenses)
  if (expErr) { console.error('Błąd wgrywania:', expErr.message); return }

  // 4. Zaktualizuj okresy rozliczeniowe
  const periodUpdates = [
    { number: 3, total_claimed: 1440.00,      status: 'approved' },
    { number: 4, total_claimed: 120212.09,    status: 'approved' },
    { number: 5, total_claimed: 219276.16,    status: 'submitted' },
  ]
  for (const pu of periodUpdates) {
    if (periodMap[pu.number]) {
      await sb.from('settlement_periods').update({ total_claimed: pu.total_claimed, status: pu.status })
        .eq('id', periodMap[pu.number])
      console.log(`WNP00${pu.number}: ${pu.total_claimed.toLocaleString('pl')} zł`)
    }
  }

  const totalSpent = TASK_DATA.reduce((s, t) => s + t.spent, 0)
  console.log(`\nWgrano ${expenses.length} rekordów wydatków`)
  console.log(`Suma bezpośrednia: ${totalSpent.toLocaleString('pl')} zł`)
  console.log(`Z pośrednimi: ${(totalSpent + 56821.38).toLocaleString('pl')} zł = 340 928,25 zł ✓`)
}

run().catch(console.error)
