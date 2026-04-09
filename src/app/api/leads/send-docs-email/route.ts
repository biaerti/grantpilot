import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { Resend } from "resend"

function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  const { leadId, projectId } = await request.json()
  if (!leadId || !projectId) {
    return NextResponse.json({ error: "Brak leadId lub projectId" }, { status: 400 })
  }

  const supabase = getAdminClient()

  // Pobierz dane leada
  const { data: lead, error: leadError } = await supabase
    .from("participants")
    .select("id, first_name, last_name, email, employment_status, disability, third_country_citizen")
    .eq("id", leadId)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead nie znaleziony" }, { status: 404 })
  }
  if (!lead.email) {
    return NextResponse.json({ error: "Lead nie ma adresu email" }, { status: 422 })
  }

  // Pobierz typy dokumentów dla projektu (dobrane do profilu leada)
  const { data: docTypes } = await supabase
    .from("recruitment_document_types")
    .select("id, name, description, who_fills, applies_to, file_url, file_name")
    .eq("project_id", projectId)
    .order("sort_order")

  // Filtruj dokumenty dopasowane do profilu leada
  const isUnemployed = lead.employment_status?.toLowerCase().includes("bezrobot") ?? false
  const isInactive = lead.employment_status?.toLowerCase().includes("bier") ?? false
  const isDisabled = lead.disability ?? false
  const isUkr = lead.third_country_citizen ?? false

  const applicableDocs = (docTypes ?? []).filter(dt => {
    if (dt.applies_to === "wszyscy") return true
    if (dt.applies_to === "bezrobotni" && (isUnemployed || isInactive)) return true
    if (dt.applies_to === "niepelnosprawni" && isDisabled) return true
    if (dt.applies_to === "ukr" && isUkr) return true
    if (dt.applies_to === "bierni" && isInactive) return true
    return false
  })

  // Zarejestruj dokumenty do dostarczenia (jeśli jeszcze nie ma)
  if (applicableDocs.length > 0) {
    const existingDocs = await supabase
      .from("lead_documents")
      .select("doc_type_id")
      .eq("participant_id", leadId)
    const existingTypeIds = new Set((existingDocs.data ?? []).map(d => d.doc_type_id))

    const toInsert = applicableDocs
      .filter(dt => !existingTypeIds.has(dt.id))
      .map(dt => ({
        participant_id: leadId,
        project_id: projectId,
        doc_type_id: dt.id,
        name: dt.name,
        delivered: false,
      }))
    if (toInsert.length > 0) {
      await supabase.from("lead_documents").insert(toInsert)
    }
  }

  // Wyślij mail
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "your_resend_api_key") {
    return NextResponse.json({ ok: true, skipped: true, reason: "RESEND_API_KEY not configured" })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: "Fundacja Pretium <rekrutacja@fundacjapretium.pl>",
      to: [lead.email],
      subject: "Dokumenty do projektu – Fundacja Pretium",
      text: buildDocsEmailText(lead.first_name, applicableDocs),
    })

    await supabase
      .from("participants")
      .update({ docs_email_sent_at: new Date().toISOString() })
      .eq("id", leadId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("send-docs-email error:", e)
    return NextResponse.json({ error: "Błąd wysyłki maila" }, { status: 500 })
  }
}

interface DocType {
  name: string
  description?: string | null
  who_fills: string
  applies_to: string
  file_url?: string | null
}

function buildDocsEmailText(firstName: string, docs: DocType[]): string {
  const whoFillsLabel = (wf: string) => {
    if (wf === "zus") return "Pobierasz sam/a z ZUS (lub Urzędu Pracy jeśli tam jesteś zarejestrowany/a)"
    if (wf === "up") return "Pobierasz z Urzędu Pracy"
    if (wf === "ops") return "Pobierasz z OPS / GOPS"
    if (wf === "my") return "Prześlemy Ci gotowy dokument"
    return "Wypełniasz samodzielnie"
  }

  const docLines = docs.map((d, i) =>
    `${i + 1}. ${d.name}\n   ${d.description ? d.description + "\n   " : ""}Skąd: ${whoFillsLabel(d.who_fills)}`
  ).join("\n\n")

  return `Dzień dobry ${firstName}!

Dziękujemy za rozmowę telefoniczną. Poniżej znajdziesz listę dokumentów, które będziemy potrzebować do Twojego udziału w projekcie.

──────────────────────────
WYMAGANE DOKUMENTY:
──────────────────────────

${docLines}

──────────────────────────

Jak dostarczyć dokumenty?

Możesz je:
- Przynieść osobiście do naszego biura (ul. Bierutowska 57-59, Wrocław – Psie Pole)
- Wysłać skan / zdjęcie w odpowiedzi na tego maila

Jeśli masz pytania – zadzwoń lub napisz, chętnie pomożemy.

Do usłyszenia,
Zespół Fundacji Pretium

──────────────────────────
Fundacja Pretium
ul. Żeromskiego 62/2, Wrocław
biuro@fundacjapretium.pl
www.fundacjapretium.pl
──────────────────────────

Administratorem Twoich danych jest Fundacja Pretium (ul. Żeromskiego 62/2, Wrocław). Dane przetwarzamy w celu realizacji projektu unijnego, na podstawie art. 6 ust. 1 lit. b RODO. Przysługuje Ci prawo dostępu, sprostowania i usunięcia danych. Kontakt: biuro@fundacjapretium.pl`
}
