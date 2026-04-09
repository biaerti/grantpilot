import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface TallySubmission {
  id: string
  formId: string
  respondentId: string
  isCompleted: boolean
  submittedAt: string
  responses: { questionId: string; answer: unknown }[]
}

interface TallyQuestion {
  id: string
  title: string
  type: string
}

// GET /api/leads/tally-sync?project_id=xxx  → lista formularzy Tally
export async function GET() {
  const apiKey = process.env.TALLY_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Brak TALLY_API_KEY" }, { status: 500 })

  const res = await fetch("https://api.tally.so/forms", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  })
  const data = await res.json()
  return NextResponse.json(data)
}

// POST /api/leads/tally-sync  body: { project_id, form_id }
// Ciągnie odpowiedzi z Tally i zapisuje nowe leady do Supabase
export async function POST(request: Request) {
  const { project_id, form_id } = await request.json()
  if (!project_id || !form_id) {
    return NextResponse.json({ error: "Wymagane: project_id i form_id" }, { status: 400 })
  }

  const apiKey = process.env.TALLY_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Brak TALLY_API_KEY" }, { status: 500 })

  // Pobierz submissions z Tally (max 100, wszystkie)
  const res = await fetch(`https://api.tally.so/forms/${form_id}/submissions?limit=100`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  })
  if (!res.ok) {
    return NextResponse.json({ error: "Błąd Tally API: " + res.status }, { status: 502 })
  }
  const data = await res.json()
  const questions: TallyQuestion[] = data.questions ?? []
  const submissions: TallySubmission[] = data.submissions ?? []

  if (submissions.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 })
  }

  // Mapa questionId → title
  const qMap: Record<string, string> = {}
  for (const q of questions) qMap[q.id] = q.title.toLowerCase()

  const supabase = getAdminClient()

  // Pobierz już istniejące tally_response_id dla tego projektu
  const { data: existing } = await supabase
    .from("participants")
    .select("tally_response_id")
    .eq("project_id", project_id)
    .not("tally_response_id", "is", null)
  const existingIds = new Set((existing ?? []).map(r => r.tally_response_id))

  let imported = 0
  let skipped = 0

  for (const sub of submissions) {
    if (!sub.isCompleted) { skipped++; continue }
    if (existingIds.has(sub.id)) { skipped++; continue }

    // Wyciągnij pola
    const getAnswer = (fragments: string[]): string => {
      for (const frag of fragments) {
        const q = questions.find(q => q.title.toLowerCase().includes(frag))
        if (!q) continue
        const r = sub.responses.find(r => r.questionId === q.id)
        if (r?.answer) {
          if (Array.isArray(r.answer)) return r.answer.join(", ")
          return String(r.answer).trim()
        }
      }
      return ""
    }

    const firstName = getAnswer(["imię", "imie", "first name"]) || "—"
    const email     = getAnswer(["e-mail", "email", "adres e-mail"])
    const phone     = getAnswer(["telefon", "numer telefonu"])
    const city      = getAnswer(["miejscowość", "miejscowosc", "miasto"])
    const statusRaw = getAnswer(["status aktualnie", "twój status"])

    const { error } = await supabase.from("participants").insert({
      project_id,
      first_name: firstName,
      last_name: "",
      phone: phone || null,
      email: email || null,
      city: city || null,
      participation_status: "lead",
      lead_status: "nowy",
      lead_source: "tally",
      tally_response_id: sub.id,
      form_answers: {
        form_id,
        submitted_at: sub.submittedAt,
        status_answers: statusRaw,
        raw: sub.responses.map(r => ({
          question: qMap[r.questionId] ?? r.questionId,
          answer: r.answer,
        })),
      },
      source: "import",
      nationality: "Obywatelstwo polskie",
      country: "Polska",
      disability: false,
      foreign_origin: false,
      third_country_citizen: false,
      minority: false,
      homeless: false,
      no_pesel: false,
    })

    if (!error) {
      imported++
      existingIds.add(sub.id)
    } else {
      console.error("Insert error for submission", sub.id, error.message)
      skipped++
    }
  }

  // Zapisz form_id jako przypisany do projektu (w project settings / metadata)
  // Na razie zwracamy wynik
  return NextResponse.json({ imported, skipped, total: submissions.length })
}
