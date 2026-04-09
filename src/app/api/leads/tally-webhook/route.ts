import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"

// Tally wysyła POST z application/json
// Struktura: { eventId, eventType, createdAt, data: { responseId, submissionId, respondentId, formId, formName, createdAt, fields: [{key, label, type, value}] } }

function extractField(fields: TallyField[], labelFragments: string[]): string {
  for (const frag of labelFragments) {
    const f = fields.find(f => f.label?.toLowerCase().includes(frag.toLowerCase()))
    if (f && f.value) return String(f.value).trim()
  }
  return ""
}

function extractMultiChoice(fields: TallyField[], labelFragments: string[]): string[] {
  for (const frag of labelFragments) {
    const f = fields.find(f => f.label?.toLowerCase().includes(frag.toLowerCase()))
    if (f && Array.isArray(f.value)) return f.value.map(String)
    if (f && f.value) return [String(f.value)]
  }
  return []
}

interface TallyField {
  key: string
  label: string
  type: string
  value: unknown
  options?: { id: string; text: string }[]
}

interface TallyWebhookBody {
  eventId: string
  eventType: string
  createdAt: string
  data: {
    responseId: string
    submissionId: string
    respondentId: string
    formId: string
    formName: string
    createdAt: string
    fields: TallyField[]
  }
}

export async function POST(request: Request) {
  // Opcjonalna weryfikacja sekretu Tally (ustaw TALLY_WEBHOOK_SECRET w .env.local)
  const secret = process.env.TALLY_WEBHOOK_SECRET
  if (secret) {
    const sigHeader = request.headers.get("tally-signature") ?? request.headers.get("x-tally-signature") ?? ""
    if (sigHeader !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  let body: TallyWebhookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.eventType !== "FORM_RESPONSE") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const fields = body.data?.fields ?? []

  // Mapowanie pól z formularza Tally
  const firstName = extractField(fields, ["imię", "imie", "first name"])
  const email = extractField(fields, ["e-mail", "email", "adres e-mail"])
  const phone = extractField(fields, ["telefon", "numer telefonu", "phone"])
  const city = extractField(fields, ["miejscowość", "miejscowosc", "miasto", "city"])
  const statusAnswers = extractMultiChoice(fields, ["status aktualnie", "twój status", "status"])

  if (!firstName) {
    return NextResponse.json({ error: "Brak imienia w formularzu" }, { status: 422 })
  }

  // Wykrywanie project_id z nazwy formularza
  // Jeśli formularz zawiera "PnS" lub "Postaw" → PnS, "Równość" → RnD
  const formName = body.data?.formName ?? ""
  let projectId = process.env.DEFAULT_PROJECT_ID ?? "27721fc6-935a-46a3-863b-b485bc0db01c"
  if (formName.toLowerCase().includes("równość") || formName.toLowerCase().includes("rownosc")) {
    projectId = "dda07567-a36f-488b-bab3-0790a89652a3"
  }

  const supabase = await createClient()

  // Sprawdź czy już nie ma leada z tym tally_response_id (deduplicacja)
  const responseId = body.data?.responseId ?? body.data?.submissionId
  if (responseId) {
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("tally_response_id", responseId)
      .single()
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
  }

  // Zapis jako lead (participation_status='lead')
  const { data: lead, error: insertError } = await supabase
    .from("participants")
    .insert({
      project_id: projectId,
      first_name: firstName,
      last_name: "",                        // uzupełni koordynator po rozmowie
      phone: phone || null,
      email: email || null,
      city: city || null,
      participation_status: "lead",
      lead_status: "nowy",
      lead_source: "tally",
      tally_response_id: responseId ?? null,
      form_answers: { fields: fields.map(f => ({ label: f.label, value: f.value })), statusAnswers },
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
    .select("id, first_name, email")
    .single()

  if (insertError || !lead) {
    console.error("Tally webhook insert error:", insertError)
    return NextResponse.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 })
  }

  // Wyślij mail potwierdzający (instant) jeśli email podany i Resend skonfigurowany
  if (email && process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "your_resend_api_key") {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "Fundacja Pretium <rekrutacja@fundacjapretium.pl>",
        to: [email],
        subject: "Twoje zgłoszenie dotarło – Fundacja Pretium",
        text: buildInstantEmailText(firstName),
      })
      await supabase
        .from("participants")
        .update({ instant_email_sent_at: new Date().toISOString() })
        .eq("id", lead.id)
    } catch (e) {
      console.error("Instant email send failed:", e)
    }
  }

  return NextResponse.json({ ok: true, leadId: lead.id })
}

function buildInstantEmailText(firstName: string): string {
  return `Dzień dobry ${firstName}!

Dziękujemy za zgłoszenie do projektu Fundacji Pretium.

Otrzymaliśmy Twoje dane i skontaktujemy się z Tobą telefonicznie w ciągu najbliższych dni roboczych (pracujemy w godz. 7:30–15:30).

Podczas rozmowy omówimy szczegóły projektu, opowiemy o dalszych krokach i sprawdzimy, czy spełniasz wymagania kwalifikacyjne. Nic Cię jeszcze do niczego nie zobowiązuje.

Jeśli masz pytania, możesz napisać na: biuro@fundacjapretium.pl

Do usłyszenia,
Zespół Fundacji Pretium

---
Fundacja Pretium
ul. Żeromskiego 62/2, Wrocław
biuro@fundacjapretium.pl
www.fundacjapretium.pl

Administratorem Twoich danych jest Fundacja Pretium (ul. Żeromskiego 62/2, Wrocław). Dane przetwarzamy w celu kontaktu w związku z projektem unijnym, na podstawie art. 6 ust. 1 lit. b RODO. Przysługuje Ci prawo dostępu, sprostowania i usunięcia danych. Kontakt: biuro@fundacjapretium.pl`
}
