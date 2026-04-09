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

/**
 * Word rozbija {{tag}} na wiele runów XML wewnątrz <w:p>.
 * Ta funkcja scala tekst wewnątrz tagów żeby docxtemplater mógł je rozpoznać.
 * Standardowe podejście: regex na surowym XML dokumentu.
 */
function fixWordXmlRuns(content: string): string {
  // Usuń znaczniki XML które Word wstawia wewnątrz {{ i }}
  // Wzorzec: {{ ... (opcjonalne tagi XML) ... }}
  return content.replace(
    /\{\{([\s\S]*?)\}\}/g,
    (match) => {
      // Usuń wszystkie tagi XML wewnątrz dopasowania
      const stripped = match.replace(/<[^>]+>/g, "")
      return stripped
    }
  )
}

export async function POST(req: NextRequest) {
  const { document_type_id, participant_id, project_id } = await req.json()

  if (!document_type_id || !participant_id || !project_id) {
    return NextResponse.json({ error: "Brak wymaganych parametrów" }, { status: 400 })
  }

  const supabase = createClient()

  const [tmplRes, partRes] = await Promise.all([
    supabase.from("document_types").select("*").eq("id", document_type_id).single(),
    supabase.from("participants").select("*").eq("id", participant_id).single(),
  ])

  if (tmplRes.error || !tmplRes.data) {
    return NextResponse.json({ error: "Nie znaleziono szablonu: " + tmplRes.error?.message }, { status: 404 })
  }
  if (partRes.error || !partRes.data) {
    return NextResponse.json({ error: "Nie znaleziono uczestnika: " + partRes.error?.message }, { status: 404 })
  }

  const template = tmplRes.data
  const participant = partRes.data

  // Sprawdź czy szablon ma plik DOCX
  let fileUrl: string | null = null
  try {
    if (template.description?.startsWith("{")) {
      const parsed = JSON.parse(template.description)
      fileUrl = parsed.file_url ?? null
    }
  } catch {}

  if (!fileUrl) {
    return NextResponse.json({ error: "Szablon nie ma wgranego pliku DOCX. Wgraj plik przy edycji szablonu." }, { status: 400 })
  }

  // Pobierz plik DOCX szablonu
  const docxResponse = await fetch(fileUrl)
  if (!docxResponse.ok) {
    return NextResponse.json({
      error: `Nie udało się pobrać pliku szablonu (${docxResponse.status}). Sprawdź czy bucket jest publiczny w Supabase Storage.`
    }, { status: 500 })
  }
  const docxBuffer = await docxResponse.arrayBuffer()

  // Zmienne uczestnika
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(participant)) {
    vars[k] = v != null ? String(v) : ""
  }

  // Generuj DOCX
  let outputBuffer: Buffer
  try {
    const zip = new PizZip(docxBuffer)

    // Napraw rozbite runy XML (Word wstawia tagi XML wewnątrz {{tag}})
    const xmlFiles = ["word/document.xml", "word/header1.xml", "word/footer1.xml",
                      "word/header2.xml", "word/footer2.xml", "word/header3.xml", "word/footer3.xml"]
    for (const fileName of xmlFiles) {
      if (!zip.files[fileName]) continue
      const fixed = fixWordXmlRuns(zip.files[fileName].asText())
      zip.file(fileName, fixed)
    }

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      nullGetter: () => "",
    })
    doc.render(vars)
    outputBuffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer
  } catch (renderErr: unknown) {
    const details = extractDocxtemplaterErrors(renderErr)
    console.error("[generate-document] render error:", details)
    return NextResponse.json({
      error: "Błąd szablonu DOCX: " + details
    }, { status: 500 })
  }

  // Zapisz do Storage
  const participantName = `${participant.last_name}_${participant.first_name}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // usuń akcenty (ą→a, ę→e itd.)
    .replace(/[^a-zA-Z0-9_-]/g, "_") // zostaw tylko bezpieczne znaki
  const storagePath = `${project_id}/${participant_id}/generated_${Date.now()}_${participantName}.docx`

  const { error: uploadErr } = await supabase.storage
    .from("participant-documents")
    .upload(storagePath, outputBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    })

  if (uploadErr) {
    return NextResponse.json({ error: "Błąd uploadu do Storage: " + uploadErr.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from("participant-documents").getPublicUrl(storagePath)

  const docName = `${template.name} – ${participant.last_name} ${participant.first_name}`
  const { data: inserted, error: insErr } = await supabase
    .from("participant_documents")
    .insert({
      participant_id,
      project_id,
      document_type_id,
      template_id: document_type_id,
      generated: true,
      name: docName,
      file_url: urlData.publicUrl,
      file_name: `${participantName}_${template.name}.docx`,
      file_size: outputBuffer.length,
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      task_id: template.task_id ?? null,
      budget_line_id: template.budget_line_id ?? null,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json({ error: "Błąd zapisu rekordu: " + insErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, document: inserted })
}
