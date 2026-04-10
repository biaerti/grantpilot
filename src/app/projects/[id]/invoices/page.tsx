"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Loader2,
  Receipt,
  FileText,
  Upload,
  ExternalLink,
  Trash2,
  Filter,
  X,
} from "lucide-react"
import type { Expense, SettlementPeriod, Task, InvoiceDocType } from "@/lib/types"

const DOC_TYPE_LABELS: Record<InvoiceDocType, string> = {
  faktura: "Faktura",
  lista_plac: "Lista płac",
  umowa_zlecenie: "Umowa zlecenie",
  umowa_o_dzielo: "Umowa o dzieło",
  rachunek: "Rachunek",
  inne: "Inne",
}

const DOC_TYPE_COLORS: Record<InvoiceDocType, string> = {
  faktura: "bg-blue-100 text-blue-700",
  lista_plac: "bg-purple-100 text-purple-700",
  umowa_zlecenie: "bg-amber-100 text-amber-700",
  umowa_o_dzielo: "bg-orange-100 text-orange-700",
  rachunek: "bg-slate-100 text-slate-700",
  inne: "bg-slate-100 text-slate-600",
}

type ExpenseWithPeriod = Expense & {
  settlement_period?: { id: string; number: number; period_start: string; period_end: string } | null
  task?: { id: string; number: number; name: string } | null
}

const EMPTY_FORM = {
  document_number: "",
  accounting_number: "",
  vendor_name: "",
  vendor_nip: "",
  document_date: "",
  payment_date: "",
  amount: "",
  description: "",
  doc_type: "faktura" as InvoiceDocType,
  task_id: "",
  settlement_period_id: "",
  notes: "",
}

export default function InvoicesPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [expenses, setExpenses] = useState<ExpenseWithPeriod[]>([])
  const [periods, setPeriods] = useState<SettlementPeriod[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialog, setAddDialog] = useState(false)
  const [editExpense, setEditExpense] = useState<ExpenseWithPeriod | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Filtry
  const [filterPeriod, setFilterPeriod] = useState<string>("all")
  const [filterDocType, setFilterDocType] = useState<string>("all")
  const [filterText, setFilterText] = useState("")

  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    setLoading(true)
    const [expRes, periodsRes, tasksRes] = await Promise.all([
      supabase
        .from("expenses")
        .select(`
          *,
          settlement_period:settlement_periods(id, number, period_start, period_end),
          task:tasks(id, number, name)
        `)
        .eq("project_id", projectId)
        .order("payment_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("settlement_periods")
        .select("*")
        .eq("project_id", projectId)
        .order("number"),
      supabase
        .from("tasks")
        .select("id, number, name")
        .eq("project_id", projectId)
        .order("number"),
    ])
    setExpenses((expRes.data ?? []) as unknown as ExpenseWithPeriod[])
    setPeriods(periodsRes.data ?? [])
    setTasks((tasksRes.data ?? []) as unknown as Task[])
    setLoading(false)
  }

  // Filtrowanie
  const filtered = expenses.filter((e) => {
    if (filterPeriod !== "all" && e.settlement_period_id !== filterPeriod) return false
    if (filterDocType !== "all" && (e.doc_type ?? "faktura") !== filterDocType) return false
    if (filterText) {
      const q = filterText.toLowerCase()
      if (
        !e.document_number?.toLowerCase().includes(q) &&
        !e.vendor_name?.toLowerCase().includes(q) &&
        !e.description?.toLowerCase().includes(q) &&
        !e.accounting_number?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const totalFiltered = filtered.reduce((s, e) => s + (e.amount ?? 0), 0)

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setPendingFile(null)
    setEditExpense(null)
    setAddDialog(true)
  }

  function openEdit(exp: ExpenseWithPeriod) {
    setForm({
      document_number: exp.document_number ?? "",
      accounting_number: exp.accounting_number ?? "",
      vendor_name: exp.vendor_name ?? "",
      vendor_nip: exp.vendor_nip ?? "",
      document_date: exp.document_date ?? "",
      payment_date: exp.payment_date ?? "",
      amount: String(exp.amount ?? ""),
      description: exp.description ?? "",
      doc_type: (exp.doc_type as InvoiceDocType) ?? "faktura",
      task_id: exp.task_id ?? "",
      settlement_period_id: exp.settlement_period_id ?? "",
      notes: exp.notes ?? "",
    })
    setPendingFile(null)
    setEditExpense(exp)
    setAddDialog(true)
  }

  async function uploadFile(expenseId: string, file: File): Promise<{ url: string; name: string; size: number } | null> {
    const ext = file.name.split(".").pop()
    const path = `${projectId}/${expenseId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("wnp-documents").upload(path, file, { upsert: true })
    if (error) { toast.error("Błąd uploadu: " + error.message); return null }
    const { data: urlData } = supabase.storage.from("wnp-documents").getPublicUrl(path)
    return { url: urlData.publicUrl, name: file.name, size: file.size }
  }

  async function handleSave() {
    if (!form.vendor_name || !form.amount) {
      toast.error("Podaj dostawcę i kwotę.")
      return
    }
    setSaving(true)

    const payload = {
      project_id: projectId,
      document_number: form.document_number || null,
      accounting_number: form.accounting_number || null,
      vendor_name: form.vendor_name,
      vendor_nip: form.vendor_nip || null,
      document_date: form.document_date || null,
      payment_date: form.payment_date || null,
      amount: parseFloat(form.amount) || 0,
      description: form.description || null,
      doc_type: form.doc_type,
      task_id: form.task_id || null,
      settlement_period_id: form.settlement_period_id || null,
      notes: form.notes || null,
      status: "paid" as const,
    }

    let savedId = editExpense?.id

    if (editExpense) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editExpense.id)
      if (error) { toast.error("Błąd: " + error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from("expenses").insert(payload).select().single()
      if (error) { toast.error("Błąd: " + error.message); setSaving(false); return }
      savedId = data.id
    }

    // Upload pliku jeśli wybrany
    if (pendingFile && savedId) {
      setUploading(true)
      const fileData = await uploadFile(savedId, pendingFile)
      if (fileData) {
        await supabase.from("expenses").update({
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        }).eq("id", savedId)
      }
      setUploading(false)
    }

    setSaving(false)
    setAddDialog(false)
    toast.success(editExpense ? "Zapisano zmiany." : "Dodano dokument.")
    fetchData()
  }

  async function handleDelete(exp: ExpenseWithPeriod) {
    if (!confirm(`Usunąć "${exp.vendor_name} – ${exp.document_number ?? exp.description}"?`)) return
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setExpenses((prev) => prev.filter((e) => e.id !== exp.id))
    toast.success("Usunięto.")
  }

  // Grupowanie po WNP do wyświetlenia sum
  const periodSums: Record<string, number> = {}
  filtered.forEach((e) => {
    const key = e.settlement_period_id ?? "__none__"
    periodSums[key] = (periodSums[key] ?? 0) + (e.amount ?? 0)
  })

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Faktury i dokumenty kosztowe"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Faktury" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" />
              Dodaj dokument
            </Button>

            {/* Filtr WNP */}
            <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v ?? "all")}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder="Wszystkie WNP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie WNP</SelectItem>
                <SelectItem value="__none__">Nieprzypisane do WNP</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    WNP{String(p.number).padStart(3, "0")} ({formatDateShort(p.period_start)} – {formatDateShort(p.period_end)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtr typ dokumentu */}
            <Select value={filterDocType} onValueChange={(v) => setFilterDocType(v ?? "all")}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="Typ dokumentu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie typy</SelectItem>
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Szukaj */}
            <div className="relative">
              <Input
                placeholder="Szukaj (nr, nazwa, opis)…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="h-9 w-64 text-sm pr-8"
              />
              {filterText && (
                <button className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600" onClick={() => setFilterText("")}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="ml-auto text-sm text-slate-500">
              {filtered.length} pozycji · <span className="font-semibold text-slate-900">{formatCurrency(totalFiltered)}</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Brak dokumentów. Dodaj pierwszą fakturę.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-3 font-medium text-slate-600">Typ</th>
                    <th className="text-left p-3 font-medium text-slate-600">Nr dokumentu</th>
                    <th className="text-left p-3 font-medium text-slate-600">Dostawca / opis</th>
                    <th className="text-left p-3 font-medium text-slate-600">Data wystawienia</th>
                    <th className="text-left p-3 font-medium text-slate-600">Data zapłaty</th>
                    <th className="text-right p-3 font-medium text-slate-600">Kwota</th>
                    <th className="text-left p-3 font-medium text-slate-600">WNP</th>
                    <th className="text-left p-3 font-medium text-slate-600">Zadanie</th>
                    <th className="text-left p-3 font-medium text-slate-600">Plik</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => openEdit(exp)}
                    >
                      <td className="p-3">
                        <Badge className={DOC_TYPE_COLORS[(exp.doc_type as InvoiceDocType) ?? "faktura"] ?? ""}>
                          {DOC_TYPE_LABELS[(exp.doc_type as InvoiceDocType) ?? "faktura"]}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-700">
                        {exp.document_number ?? <span className="text-slate-300">—</span>}
                        {exp.accounting_number && (
                          <div className="text-slate-400 text-xs">{exp.accounting_number}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-slate-900">{exp.vendor_name}</p>
                        {exp.description && <p className="text-xs text-slate-500 truncate max-w-xs">{exp.description}</p>}
                      </td>
                      <td className="p-3 text-slate-600">
                        {exp.document_date ? formatDateShort(exp.document_date) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="p-3 text-slate-600">
                        {exp.payment_date ? formatDateShort(exp.payment_date) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-900">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="p-3">
                        {exp.settlement_period ? (
                          <span className="text-xs text-blue-700 font-medium">
                            WNP{String(exp.settlement_period.number).padStart(3, "0")}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {exp.task ? `Zad. ${exp.task.number}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {exp.file_url ? (
                          <a href={exp.file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <FileText className="w-4 h-4 text-slate-200" />
                        )}
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          onClick={() => handleDelete(exp)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={5} className="p-3 font-semibold text-slate-700 text-right">Suma:</td>
                    <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(totalFiltered)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Dialog dodaj/edytuj */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editExpense ? "Edytuj dokument" : "Dodaj dokument kosztowy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {/* Typ dokumentu */}
              <div className="space-y-1.5">
                <Label>Typ dokumentu *</Label>
                <Select
                  value={form.doc_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, doc_type: (v ?? "faktura") as InvoiceDocType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nr dokumentu */}
              <div className="space-y-1.5">
                <Label>Nr dokumentu</Label>
                <Input
                  placeholder="FV/2025/001"
                  value={form.document_number}
                  onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Dostawca */}
              <div className="space-y-1.5">
                <Label>Dostawca / wystawca *</Label>
                <Input
                  placeholder="Nazwa firmy lub osoby"
                  value={form.vendor_name}
                  onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
                />
              </div>
              {/* NIP */}
              <div className="space-y-1.5">
                <Label>NIP</Label>
                <Input
                  placeholder="123-456-78-90"
                  value={form.vendor_nip}
                  onChange={(e) => setForm((f) => ({ ...f, vendor_nip: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Data wystawienia */}
              <div className="space-y-1.5">
                <Label>Data wystawienia</Label>
                <Input
                  type="date"
                  value={form.document_date}
                  onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))}
                />
              </div>
              {/* Data zapłaty */}
              <div className="space-y-1.5">
                <Label>Data zapłaty</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </div>
              {/* Kwota */}
              <div className="space-y-1.5">
                <Label>Kwota (zł) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>

            {/* Opis */}
            <div className="space-y-1.5">
              <Label>Opis / tytuł</Label>
              <Input
                placeholder="Np. Szkolenie zawodowe – marzec 2025"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* WNP */}
              <div className="space-y-1.5">
                <Label>Wniosek o płatność (WNP)</Label>
                <Select
                  value={form.settlement_period_id || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, settlement_period_id: v === "none" ? "" : (v ?? "") }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nieprzypisany" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nieprzypisany</SelectItem>
                    {periods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        WNP{String(p.number).padStart(3, "0")} ({formatDateShort(p.period_start)} – {formatDateShort(p.period_end)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zadanie */}
              <div className="space-y-1.5">
                <Label>Zadanie budżetowe</Label>
                <Select
                  value={form.task_id || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, task_id: v === "none" ? "" : (v ?? "") }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Brak przypisania" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak przypisania</SelectItem>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Zad. {t.number}: {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nr księgowy */}
            <div className="space-y-1.5">
              <Label>Nr księgowy (opcjonalnie)</Label>
              <Input
                placeholder="PK/2025/001"
                value={form.accounting_number}
                onChange={(e) => setForm((f) => ({ ...f, accounting_number: e.target.value }))}
              />
            </div>

            {/* Notatki */}
            <div className="space-y-1.5">
              <Label>Notatki</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Upload pliku */}
            <div className="space-y-1.5">
              <Label>Plik (PDF, JPG, PNG)</Label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
                {pendingFile ? (
                  <div className="flex items-center justify-center gap-2 text-blue-700">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">{pendingFile.name}</span>
                    <button
                      className="ml-1 text-slate-400 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); setPendingFile(null) }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : editExpense?.file_name ? (
                  <div className="text-sm text-slate-500">
                    <FileText className="w-4 h-4 inline mr-1" />
                    {editExpense.file_name} (kliknij żeby zastąpić)
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    <Upload className="w-4 h-4 inline mr-1" />
                    Kliknij żeby wybrać plik
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {(saving || uploading) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editExpense ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
