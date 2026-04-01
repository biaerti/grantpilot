"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCurrency, formatDateShort, accountingStatusLabel, formatRelative } from "@/lib/utils"
import { toast } from "sonner"
import { Receipt, CheckCircle, Loader2, FileText, Filter } from "lucide-react"
interface EnrichedRequest {
  id: string
  project_id: string
  event_id?: string
  organization_id?: string
  amount: number
  description: string
  status: "pending" | "invoiced" | "paid"
  notes_for_accountant?: string
  invoice_number?: string
  invoice_date?: string
  expense_id?: string
  created_at: string
  resolved_at?: string
  project: { id: string; name: string; short_name?: string } | null
  event: { id: string; name: string } | null
  organization: { id: string; name: string } | null
}

export default function AccountingPage() {
  const supabase = createClient()

  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("pending")
  const [invoiceDialog, setInvoiceDialog] = useState<{ open: boolean; request: EnrichedRequest | null }>({ open: false, request: null })
  const [invoiceData, setInvoiceData] = useState({ invoice_number: "", invoice_date: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase
      .from("accounting_requests")
      .select("*, project:projects(id,name,short_name), event:events(id,name), organization:organizations(id,name)")
      .order("created_at", { ascending: false })

    if (!error) setRequests(data ?? [])
    setLoading(false)
  }

  const filtered = filterStatus === "all"
    ? requests
    : requests.filter((r) => r.status === filterStatus)

  const counts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleMarkInvoiced = async () => {
    if (!invoiceDialog.request) return
    if (!invoiceData.invoice_number || !invoiceData.invoice_date) {
      toast.error("Podaj numer faktury i datę.")
      return
    }
    setSaving(true)

    // Update accounting request
    const { error } = await supabase
      .from("accounting_requests")
      .update({
        status: "invoiced",
        invoice_number: invoiceData.invoice_number,
        invoice_date: invoiceData.invoice_date,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", invoiceDialog.request.id)

    if (error) { setSaving(false); toast.error("Błąd: " + error.message); return }

    // Create expense record
    await supabase.from("expenses").insert({
      project_id: invoiceDialog.request.project_id,
      event_id: invoiceDialog.request.event_id,
      organization_id: invoiceDialog.request.organization_id,
      amount: invoiceDialog.request.amount,
      description: invoiceDialog.request.description,
      document_number: invoiceData.invoice_number,
      document_date: invoiceData.invoice_date,
      status: "invoiced",
    })

    setSaving(false)
    setRequests((prev) =>
      prev.map((r) =>
        r.id === invoiceDialog.request!.id
          ? { ...r, status: "invoiced" as const, invoice_number: invoiceData.invoice_number, invoice_date: invoiceData.invoice_date }
          : r
      )
    )
    setInvoiceDialog({ open: false, request: null })
    setInvoiceData({ invoice_number: "", invoice_date: "" })
    toast.success("Faktura zarejestrowana!")
  }

  const handleMarkPaid = async (requestId: string) => {
    const { error } = await supabase
      .from("accounting_requests")
      .update({ status: "paid" })
      .eq("id", requestId)

    if (error) { toast.error("Błąd: " + error.message); return }

    // Update linked expense
    const request = requests.find((r) => r.id === requestId)
    if (request?.expense_id) {
      await supabase
        .from("expenses")
        .update({ status: "paid" })
        .eq("id", request.expense_id)
    }

    setRequests((prev) =>
      prev.map((r) => r.id === requestId ? { ...r, status: "paid" as const } : r)
    )
    toast.success("Oznaczono jako opłacone.")
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    invoiced: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
  }

  const pendingTotal = requests.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0)
  const invoicedTotal = requests.filter((r) => r.status === "invoiced").reduce((s, r) => s + r.amount, 0)

  return (
    <div className="flex h-screen">
      <Sidebar pendingAccountingCount={counts.pending ?? 0} />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header title="Rozliczenia – zlecenia fakturowania" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Oczekuje na fakturę</p>
                    <p className="text-xl font-bold text-slate-900">{counts.pending ?? 0}</p>
                    <p className="text-xs text-amber-600 font-medium">{formatCurrency(pendingTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Zafakturowane</p>
                    <p className="text-xl font-bold text-slate-900">{counts.invoiced ?? 0}</p>
                    <p className="text-xs text-blue-600 font-medium">{formatCurrency(invoicedTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Opłacone</p>
                    <p className="text-xl font-bold text-slate-900">{counts.paid ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2">
            {[
              { value: "pending", label: "Oczekujące" },
              { value: "invoiced", label: "Zafakturowane" },
              { value: "paid", label: "Opłacone" },
              { value: "all", label: "Wszystkie" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {f.label}
                {counts[f.value] && f.value !== "all" ? (
                  <span className="ml-1.5 opacity-75">({counts[f.value]})</span>
                ) : ""}
              </button>
            ))}
          </div>

          {/* Requests list */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Brak zleceń w wybranej kategorii.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((req) => (
                <Card key={req.id} className={req.status === "pending" ? "border-amber-200" : ""}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={statusColors[req.status] ?? ""}>
                            {accountingStatusLabel(req.status)}
                          </Badge>
                          {req.project && (
                            <span className="text-xs text-slate-500 truncate">
                              {req.project.short_name ?? req.project.name}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-slate-900 mb-1">
                          {req.event?.name ?? req.description.slice(0, 60)}
                        </h3>

                        <div className="text-sm text-slate-600 space-y-1">
                          <p className="leading-relaxed">{req.description}</p>
                          {req.organization && (
                            <p className="text-slate-500">
                              <span className="font-medium">Podmiot:</span> {req.organization.name}
                            </p>
                          )}
                          {req.notes_for_accountant && (
                            <p className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-xs">
                              Uwaga dla Kamili: {req.notes_for_accountant}
                            </p>
                          )}
                          {req.invoice_number && (
                            <p className="text-slate-500 text-xs">
                              Faktura: <span className="font-medium text-slate-700">{req.invoice_number}</span>
                              {req.invoice_date && ` z dnia ${formatDateShort(req.invoice_date)}`}
                            </p>
                          )}
                          <p className="text-xs text-slate-400">{formatRelative(req.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(req.amount)}</p>

                        <div className="flex flex-col gap-1 mt-3">
                          {req.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setInvoiceData({ invoice_number: "", invoice_date: new Date().toISOString().split("T")[0] })
                                setInvoiceDialog({ open: true, request: req })
                              }}
                            >
                              Wystawiłam fakturę
                            </Button>
                          )}
                          {req.status === "invoiced" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => handleMarkPaid(req.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Opłacono
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Invoice dialog */}
      <Dialog open={invoiceDialog.open} onOpenChange={(open) => !open && setInvoiceDialog({ open: false, request: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejestracja faktury</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <p className="text-slate-500 text-xs mb-1">Opis do faktury:</p>
              <p className="text-slate-700">{invoiceDialog.request?.description}</p>
              <p className="text-slate-900 font-bold mt-2">{formatCurrency(invoiceDialog.request?.amount)}</p>
            </div>
            <div className="space-y-2">
              <Label>Numer faktury *</Label>
              <Input
                placeholder="FV/2026/001"
                value={invoiceData.invoice_number}
                onChange={(e) => setInvoiceData((p) => ({ ...p, invoice_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data wystawienia *</Label>
              <Input
                type="date"
                value={invoiceData.invoice_date}
                onChange={(e) => setInvoiceData((p) => ({ ...p, invoice_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialog({ open: false, request: null })}>Anuluj</Button>
            <Button onClick={handleMarkInvoiced} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Zapisz fakturę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
