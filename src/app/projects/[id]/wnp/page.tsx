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
import { formatCurrency, formatDateShort, settlementStatusLabel } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Loader2,
  FileText,
  CheckCircle,
  Upload,
  ExternalLink,
  X,
} from "lucide-react"
import type { SettlementPeriod, Project, WnpType } from "@/lib/types"

const WNP_TYPE_LABELS: Record<WnpType, string> = {
  zaliczkowy: "Zaliczkowy",
  rozliczeniowy: "Rozliczeniowy",
  sprawozdawczy: "Sprawozdawczy",
}

const WNP_TYPE_COLORS: Record<WnpType, string> = {
  zaliczkowy: "bg-green-100 text-green-700",
  rozliczeniowy: "bg-blue-100 text-blue-700",
  sprawozdawczy: "bg-purple-100 text-purple-700",
}

export default function WNPPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [periods, setPeriods] = useState<SettlementPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialog, setAddDialog] = useState(false)
  const [editPeriod, setEditPeriod] = useState<SettlementPeriod | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    number: "",
    period_start: "",
    period_end: "",
    wnp_type: "rozliczeniowy" as WnpType,
    advance_amount: "",
    notes: "",
  })

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [projectRes, periodsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("settlement_periods").select("*").eq("project_id", projectId).order("number"),
    ])
    setProject(projectRes.data)
    setPeriods(periodsRes.data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ number: "", period_start: "", period_end: "", wnp_type: "rozliczeniowy", advance_amount: "", notes: "" })
    setPendingFile(null)
    setEditPeriod(null)
    setAddDialog(true)
  }

  function openEdit(period: SettlementPeriod) {
    setForm({
      number: String(period.number),
      period_start: period.period_start,
      period_end: period.period_end,
      wnp_type: (period.wnp_type as WnpType) ?? "rozliczeniowy",
      advance_amount: String(period.advance_amount ?? ""),
      notes: period.notes ?? "",
    })
    setPendingFile(null)
    setEditPeriod(period)
    setAddDialog(true)
  }

  async function uploadFile(periodId: string, file: File): Promise<{ url: string; name: string; size: number } | null> {
    const ext = file.name.split(".").pop()
    const path = `${projectId}/wnp/${periodId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("wnp-documents").upload(path, file, { upsert: true })
    if (error) { toast.error("Błąd uploadu: " + error.message); return null }
    const { data: urlData } = supabase.storage.from("wnp-documents").getPublicUrl(path)
    return { url: urlData.publicUrl, name: file.name, size: file.size }
  }

  async function handleSave() {
    if (!form.number || !form.period_start || !form.period_end) {
      toast.error("Podaj numer, datę start i koniec okresu.")
      return
    }
    setSaving(true)

    const payload = {
      project_id: projectId,
      number: parseInt(form.number),
      period_start: form.period_start,
      period_end: form.period_end,
      wnp_type: form.wnp_type,
      advance_amount: parseFloat(form.advance_amount) || 0,
      notes: form.notes || null,
      ...(editPeriod ? {} : { status: "draft" }),
    }

    let savedId = editPeriod?.id

    if (editPeriod) {
      const { error } = await supabase.from("settlement_periods").update(payload).eq("id", editPeriod.id)
      if (error) { toast.error("Błąd: " + error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from("settlement_periods").insert(payload).select().single()
      if (error) { toast.error("Błąd: " + error.message); setSaving(false); return }
      savedId = data.id
    }

    // Upload pliku PDF
    if (pendingFile && savedId) {
      setUploading(true)
      const fileData = await uploadFile(savedId, pendingFile)
      if (fileData) {
        await supabase.from("settlement_periods").update({
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        }).eq("id", savedId)
      }
      setUploading(false)
    }

    setSaving(false)
    setAddDialog(false)
    toast.success(editPeriod ? "Zapisano zmiany." : "Okres rozliczeniowy dodany!")
    fetchData()
  }

  const handleStatusChange = async (periodId: string, newStatus: string) => {
    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === "submitted") updateData.submitted_at = new Date().toISOString()
    if (newStatus === "approved") updateData.approved_at = new Date().toISOString()

    const { error } = await supabase
      .from("settlement_periods")
      .update(updateData)
      .eq("id", periodId)

    if (error) { toast.error("Błąd: " + error.message); return }
    setPeriods((prev) => prev.map((p) => p.id === periodId ? { ...p, status: newStatus as SettlementPeriod["status"] } : p))
    toast.success("Status zaktualizowany.")
  }

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Wnioski o płatność (WNP)"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "WNP" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-600">{periods.length} okresów rozliczeniowych</p>
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" />
              Nowy WNP
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : periods.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Brak wniosków o płatność. Utwórz pierwszy WNP.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {periods.map((period) => (
                <Card
                  key={period.id}
                  className="cursor-pointer hover:border-blue-200 transition-colors"
                  onClick={() => openEdit(period)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-blue-700 text-sm">
                            WNP{String(period.number).padStart(3, "0")}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">
                              WNP{String(period.number).padStart(3, "0")} – Wniosek o płatność nr {period.number}
                            </h3>
                            {period.wnp_type && (
                              <Badge className={WNP_TYPE_COLORS[period.wnp_type as WnpType] ?? ""}>
                                {WNP_TYPE_LABELS[period.wnp_type as WnpType]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">
                            Okres: {formatDateShort(period.period_start)} – {formatDateShort(period.period_end)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Plik PDF */}
                        {period.file_url && (
                          <a
                            href={period.file_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-md px-2 py-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {period.file_name ?? "PDF"}
                          </a>
                        )}
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Kwota</p>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(period.total_claimed)}
                          </p>
                        </div>
                        <Badge className={statusColors[period.status] ?? ""}>
                          {settlementStatusLabel(period.status)}
                        </Badge>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {period.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(period.id, "submitted")}>
                              Złóż WNP
                            </Button>
                          )}
                          {period.status === "submitted" && (
                            <Button size="sm" onClick={() => handleStatusChange(period.id, "approved")}>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Zatwierdź
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {period.notes && (
                      <p className="text-sm text-slate-500 mt-3 pt-3 border-t border-slate-100">{period.notes}</p>
                    )}

                    {period.advance_amount > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">Zaliczka</p>
                          <p className="font-medium">{formatCurrency(period.advance_amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Wnioskowane</p>
                          <p className="font-medium">{formatCurrency(period.total_claimed)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Zatwierdzone</p>
                          <p className="font-medium">{period.total_approved ? formatCurrency(period.total_approved) : "—"}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Suma */}
              <Card className="bg-slate-50">
                <CardContent className="p-4 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Łącznie rozliczone</span>
                  <span className="font-bold text-slate-900 text-lg">
                    {formatCurrency(periods.reduce((s, p) => s + (p.total_claimed ?? 0), 0))}
                  </span>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Dialog dodaj/edytuj */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPeriod ? "Edytuj WNP" : "Nowy wniosek o płatność (WNP)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Numer WNP *</Label>
                <Input
                  type="number"
                  placeholder="3"
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Typ wniosku *</Label>
                <Select
                  value={form.wnp_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, wnp_type: (v ?? "rozliczeniowy") as WnpType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WNP_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data od *</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data do *</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kwota zaliczki (zł)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.advance_amount}
                onChange={(e) => setForm((f) => ({ ...f, advance_amount: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notatki</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Upload PDF wniosku */}
            <div className="space-y-2">
              <Label>Plik PDF wniosku</Label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
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
                ) : editPeriod?.file_name ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <FileText className="w-4 h-4" />
                    {editPeriod.file_name}
                    <a
                      href={editPeriod.file_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5 inline" />
                    </a>
                    <span className="text-slate-400">(kliknij żeby zastąpić)</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    <Upload className="w-4 h-4 inline mr-1" />
                    Kliknij żeby wgrać PDF wniosku
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {(saving || uploading) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editPeriod ? "Zapisz" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
