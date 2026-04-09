import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function extractDocxtemplaterErrors(err: unknown): string {
  const e = err as { properties?: { errors?: unknown[]; explanation?: string } }
  if (e?.properties?.errors?.length) {
    return e.properties.errors
      .map((x: unknown) => {
        const xe = x as { properties?: { explanation?: string; tag?: string; id?: string } }
        return [xe?.properties?.explanation, xe?.properties?.tag, xe?.properties?.id]
          .filter(Boolean).join(" / ")
      })
      .filter(Boolean)
      .join(" | ")
  }
  return e?.properties?.explanation ?? String(err)
}

function fixWordXmlRuns(content: string): string {
  return content.replace(
    /\{\{([\s\S]*?)\}\}/g,
    (match) => match.replace(/<[^>]+>/g, "")
  )
}

const POLISH_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
]
const POLISH_MONTHS_NOM = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
]

function formatPolishMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number)
  return `${POLISH_MONTHS_NOM[m - 1]} ${y}`
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return "0,00 zł"
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v)
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

// Odmiana słowa "sesja"
function pluralSesja(n: number): string {
  if (n === 1) return "1 sesję"
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} sesje`
  return `${n} sesji`
}

export async function POST(req: NextRequest) {
  const {
    project_id,
    contract_id,
    contractor_id,
    task_id,
    month,
    event_ids,
    template_id,
  } = await req.json()

  if (!project_id || !month) {
    return NextResponse.json({ error: "Brak wymaganych parametrów (project_id, month)" }, { status: 400 })
  }

  const supabase = createClient()

  // Pobierz dane równolegle
  const [projectRes, contractRes, eventsRes, participantsRes] = await Promise.all([
    supabase.from("projects").select("id, name, project_number").eq("id", project_id).single(),
    contract_id
      ? supabase.from("contracts")
          .select("*, contractor:contractors(id, name, nip, address), task:tasks(id, number, name)")
          .eq("id", contract_id).single()
      : Promise.resolve({ data: null, error: null }),
    event_ids?.length
      ? supabase.from("events")
          .select("id, name, planned_date, planned_hours, planned_cost, planned_participants_count")
          .in("id", event_ids)
      : Promise.resolve({ data: [], error: null }),
    event_ids?.length
      ? supabase.from("event_participants")
          .select("participant_id")
          .in("event_id", event_ids)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (projectRes.error) {
    return NextResponse.json({ error: "Nie znaleziono projektu: " + projectRes.error.message }, { status: 404 })
  }

  const project = projectRes.data
  const contract = contractRes.data as {
    id: string; name: string; contract_number?: string | null; scope?: string | null
    amount?: number | null; date_from?: string | null; date_to?: string | null
    contractor?: { id: string; name: string; nip?: string | null; address?: string | null } | null
    task?: { id: string; number: number; name: string } | null
  } | null
  const events = eventsRes.data ?? []
  const allParticipants = participantsRes.data ?? []

  // Oblicz agregaty
  const totalHours = events.reduce((s, ev) => s + (ev.planned_hours ?? 0), 0)
  const totalAmount = events.reduce((s, ev) => s + (ev.planned_cost ?? 0), 0)
  const uniqueParticipants = new Set(allParticipants.map((p: { participant_id: string }) => p.participant_id)).size
  const eventCount = events.length

  // Generuj treść podsumowania po polsku
  const monthLabel = formatPolishMonth(month)
  const contractorName = contract?.contractor?.name ?? "—"
  const taskLabel = contract?.task ? `Zadanie ${contract.task.number}: ${contract.task.name}` : ""
  const contentSummary = [
    `W miesiącu ${monthLabel} firma ${contractorName} zrealizowała ${pluralSesja(eventCount)}`,
    `łącznie ${totalHours}h`,
    `dla ${uniqueParticipants} uczestników`,
    taskLabel ? `w ramach: ${taskLabel}` : "",
    `na łączną kwotę ${formatCurrency(totalAmount)}.`,
  ].filter(Boolean).join(", ").replace(", na łączną", ". Łączna wartość:")

  // Buduj zmienne do szablonu DOCX
  const [y, m] = month.split("-").map(Number)
  const vars: Record<string, unknown> = {
    project_name: project.name,
    project_number: project.project_number,
    contractor_name: contractorName,
    contractor_nip: contract?.contractor?.nip ?? "",
    contractor_address: contract?.contractor?.address ?? "",
    contract_name: contract?.name ?? "",
    contract_number: contract?.contract_number ?? "",
    contract_amount: contract?.amount != null ? formatCurrency(contract.amount) : "",
    contract_scope: contract?.scope ?? "",
    date_from: formatDate(contract?.date_from),
    date_to: formatDate(contract?.date_to),
    task_name: contract?.task?.name ?? "",
    task_number: contract?.task ? String(contract.task.number) : "",
    settlement_month: monthLabel,
    settlement_month_short: `${POLISH_MONTHS[m - 1]} ${y}`,
    total_hours: String(totalHours),
    total_participants: String(uniqueParticipants),
    total_amount: formatCurrency(totalAmount),
    event_count: String(eventCount),
    content_summary: contentSummary,
    content: contentSummary,           // alias — {{content}} w szablonie DOCX
    // Lista zdarzeń (do loop {#events}...{/events})
    events: events.map(ev => ({
      date: formatDate(ev.planned_date),
      name: ev.name,
      hours: ev.planned_hours != null ? String(ev.planned_hours) : "—",
      amount: ev.planned_cost != null ? formatCurrency(ev.planned_cost) : "—",
    })),
  }

  let documentUrl: string | null = null

  // Generuj DOCX jeśli jest szablon
  if (template_id) {
    const { data: tmpl } = await supabase
      .from("document_types")
      .select("name, description")
      .eq("id", template_id)
      .single()

    let fileUrl: string | null = null
    try {
      if (tmpl?.description?.startsWith("{")) {
        fileUrl = JSON.parse(tmpl.description).file_url ?? null
      }
    } catch {}

    if (fileUrl) {
      const docxResponse = await fetch(fileUrl)
      if (docxResponse.ok) {
        const docxBuffer = await docxResponse.arrayBuffer()
        try {
          const zip = new PizZip(docxBuffer)
          const xmlFiles = [
            "word/document.xml", "word/header1.xml", "word/footer1.xml",
            "word/header2.xml", "word/footer2.xml", "word/header3.xml", "word/footer3.xml",
          ]
          for (const fileName of xmlFiles) {
            if (!zip.files[fileName]) continue
            zip.file(fileName, fixWordXmlRuns(zip.files[fileName].asText()))
          }
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: "{{", end: "}}" },
            nullGetter: () => "",
          })
          doc.render(vars)
          const outputBuffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer

          const slug = contractorName
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .substring(0, 40)
          const storagePath = `${project_id}/protocols/${month}_${slug}_${Date.now()}.docx`

          const { error: uploadErr } = await supabase.storage
            .from("participant-documents")
            .upload(storagePath, outputBuffer, {
              contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              upsert: false,
            })

          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from("participant-documents")
              .getPublicUrl(storagePath)
            documentUrl = urlData.publicUrl
          }
        } catch (renderErr: unknown) {
          const details = extractDocxtemplaterErrors(renderErr)
          console.error("[generate-protocol] render error:", details)
          // Nie przerywaj — zapisz protokół bez DOCX
        }
      }
    }
  }

  // Zapisz protokół do bazy
  const { data: inserted, error: insErr } = await supabase
    .from("protocols")
    .insert({
      project_id,
      contract_id: contract_id ?? null,
      contractor_id: contractor_id ?? null,
      task_id: task_id ?? null,
      template_id: template_id ?? null,
      month,
      total_hours: totalHours,
      total_participants: uniqueParticipants,
      total_amount: totalAmount,
      event_count: eventCount,
      content_summary: contentSummary,
      event_ids: event_ids ?? [],
      document_url: documentUrl,
      status: documentUrl ? "generated" : "draft",
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: "Błąd zapisu protokołu: " + insErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, protocol: inserted })
}
