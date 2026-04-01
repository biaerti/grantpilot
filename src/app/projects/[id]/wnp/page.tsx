"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatCurrency, formatDateShort, settlementStatusLabel } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Loader2, FileText, CheckCircle } from "lucide-react"
import type { SettlementPeriod, Project } from "@/lib/types"

export default function WNPPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [periods, setPeriods] = useState<SettlementPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialog, setAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newPeriod, setNewPeriod] = useState({
    number: "",
    period_start: "",
    period_end: "",
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

  const handleAddPeriod = async () => {
    if (!newPeriod.number || !newPeriod.period_start || !newPeriod.period_end) {
      toast.error("Podaj numer, datę start i koniec okresu.")
      return
    }
    setSaving(true)

    const { data, error } = await supabase
      .from("settlement_periods")
      .insert({
        project_id: projectId,
        number: parseInt(newPeriod.number),
        period_start: newPeriod.period_start,
        period_end: newPeriod.period_end,
        advance_amount: parseFloat(newPeriod.advance_amount) || 0,
        notes: newPeriod.notes || null,
        status: "draft",
      })
      .select()
      .single()

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }

    setPeriods((prev) => [...prev, data].sort((a, b) => a.number - b.number))
    setAddDialog(false)
    setNewPeriod({ number: "", period_start: "", period_end: "", advance_amount: "", notes: "" })
    toast.success("Okres rozliczeniowy dodany!")
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
            <Button size="sm" onClick={() => setAddDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nowy okres WNP
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
                <Card key={period.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-blue-700 text-sm">
                            WNP{String(period.number).padStart(3, "0")}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            WNP{String(period.number).padStart(3, "0")} – Wniosek o płatność nr {period.number}
                          </h3>
                          <p className="text-sm text-slate-500">
                            Okres: {formatDateShort(period.period_start)} – {formatDateShort(period.period_end)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Kwota</p>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(period.total_claimed)}
                          </p>
                        </div>
                        <Badge className={statusColors[period.status] ?? ""}>
                          {settlementStatusLabel(period.status)}
                        </Badge>
                        <div className="flex gap-1">
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
            </div>
          )}
        </main>
      </div>

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowy okres rozliczeniowy (WNP)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Numer WNP *</Label>
              <Input
                type="number"
                placeholder="3"
                value={newPeriod.number}
                onChange={(e) => setNewPeriod((p) => ({ ...p, number: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data od *</Label>
                <Input
                  type="date"
                  value={newPeriod.period_start}
                  onChange={(e) => setNewPeriod((p) => ({ ...p, period_start: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data do *</Label>
                <Input
                  type="date"
                  value={newPeriod.period_end}
                  onChange={(e) => setNewPeriod((p) => ({ ...p, period_end: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kwota zaliczki (zł)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newPeriod.advance_amount}
                onChange={(e) => setNewPeriod((p) => ({ ...p, advance_amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notatki</Label>
              <Textarea
                value={newPeriod.notes}
                onChange={(e) => setNewPeriod((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={handleAddPeriod} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Utwórz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
