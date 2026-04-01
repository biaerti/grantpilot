import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { accounting_request_id } = body

  if (!accounting_request_id) {
    return NextResponse.json({ error: "accounting_request_id is required" }, { status: 400 })
  }

  const { data: req, error } = await supabase
    .from("accounting_requests")
    .select("*, project:projects(name,short_name), event:events(name)")
    .eq("id", accounting_request_id)
    .single()

  if (error || !req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  // Send email notification if RESEND is configured
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "your_resend_api_key") {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)

      await resend.emails.send({
        from: "GrantPilot <noreply@grantpilot.pl>",
        to: ["kamila@fundacja.pl"],
        subject: `[GrantPilot] Nowe zlecenie fakturowania – ${req.project?.short_name ?? req.project?.name}`,
        html: `
          <h2>Nowe zlecenie fakturowania</h2>
          <p><strong>Projekt:</strong> ${req.project?.name}</p>
          <p><strong>Zdarzenie:</strong> ${req.event?.name ?? "—"}</p>
          <p><strong>Opis do faktury:</strong></p>
          <blockquote>${req.description}</blockquote>
          <p><strong>Kwota:</strong> ${new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(req.amount)}</p>
          ${req.notes_for_accountant ? `<p><strong>Uwagi:</strong> ${req.notes_for_accountant}</p>` : ""}
          <hr>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/accounting">Przejdź do systemu</a></p>
        `,
      })
    } catch (emailError) {
      console.error("Email notification failed:", emailError)
      // Don't fail the request if email fails
    }
  }

  return NextResponse.json({ success: true, message: "Notification sent" })
}
