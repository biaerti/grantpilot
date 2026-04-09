"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Loader2, Trash2, Pencil, Target, ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"
import type { Project, ProjectIndicator, IndicatorType, IndicatorAutoField } from "@/lib/types"

const AUTO_FIELD_LABELS: Record<string, string> = {
  participants_total:               "Auto: łączna liczba uczestników",
  participants_female:              "Auto: uczestniczki (K)",
  participants_male:                "Auto: uczestnicy (M)",
  participants_age_18_29:           "Auto: uczestnicy 18–29 lat",
  participants_age_55:              "Auto: uczestnicy 55+ lat",
  participants_rural:               "Auto: uczestnicy z obszarów wiejskich (DEGURBA=3)",
  participants_disabled:            "Auto: uczestnicy z niepełnosprawnością",
  participants_homeless:            "Auto: uczestnicy bezdomni / wyklucz. mieszk.",
  participants_minority:            "Auto: uczestnicy – mniejszości",
  participants_unemployed:          "Auto: uczestnicy bezrobotni",
  participants_inactive:            "Auto: uczestnicy bierni zawodowo",
  participants_long_term_unemployed:"Auto: uczestnicy długotrwale bezrobotni",
  events_count:                     "Auto: liczba zdarzeń (wsparć)",
}

const TYPE_CONFIG: Record<IndicatorType, { label: string; color: string; bg: string; desc: string }> = {
  product: { label: "Produkt",  color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",    desc: "Twardy wskaźnik produktu z wniosku (np. liczba uczestników)" },
  result:  { label: "Rezultat", color: "text-green-700",  bg: "bg-green-50 border-green-200",  desc: "Twardy wskaźnik rezultatu z wniosku (np. liczba osób pracujących)" },
  soft:    { label: "Miękki",   color: "text-violet-700", bg: "bg-violet-50 border-violet-200", desc: "Miękki wskaźnik projektowy" },
}

interface ParticipantRow {
  gender?: string | null
  age_at_start?: number | null
  degurba?: number | null
  disability?: boolean
  homeless?: boolean
  minority?: boolean
  employment_status?: string | null
  employment_detail?: string | null
}

// Counts per indicator from participant_indicators
interface IndicatorCounts {
  noted: number    // zanotowane (żółte) — uczestnik aktywny, wskaźnik wstępnie spełniony
  achieved: number // osiągnięte (zielone) — uczestnik zakończył udział
}

function computeAutoValue(field: string, participants: ParticipantRow[], eventsCount: number): number {
  switch (field) {
    case "participants_total":               return participants.length
    case "participants_female":              return participants.filter(p => p.gender === "K").length
    case "participants_male":                return participants.filter(p => p.gender === "M").length
    case "participants_age_18_29":           return participants.filter(p => (p.age_at_start ?? 0) >= 18 && (p.age_at_start ?? 0) <= 29).length
    case "participants_age_55":              return participants.filter(p => (p.age_at_start ?? 0) >= 55).length
    case "participants_rural":               return participants.filter(p => p.degurba === 3).length
    case "participants_disabled":            return participants.filter(p => p.disability).length
    case "participants_homeless":            return participants.filter(p => p.homeless).length
    case "participants_minority":            return participants.filter(p => p.minority).length
    case "participants_unemployed":          return participants.filter(p => p.employment_status?.toLowerCase().includes("bezrobot")).length
    case "participants_inactive":            return participants.filter(p => p.employment_status?.toLowerCase().includes("bier")).length
    case "participants_long_term_unemployed":return participants.filter(p =>
      p.employment_detail?.toLowerCase().includes("długotrwale") ||
      p.employment_status?.toLowerCase().includes("długotrwale")
    ).length
    case "events_count":                     return eventsCount
    default:                                 return 0
  }
}

// Progress bar dla wskaźników produktu/miękkich (jeden kolor)
function SimpleProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  const barColor = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-blue-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={`font-semibold ${pct >= 100 ? "text-green-600" : pct >= 70 ? "text-slate-700" : "text-amber-600"}`}>
          {value} / {target} {pct > 0 && <span className="text-slate-400 font-normal">({pct}%)</span>}
        </span>
        <span className={`font-medium ${pct >= 100 ? "text-green-600" : "text-slate-400"}`}>
          {pct >= 100 ? "✓ osiągnięty" : `brakuje: ${Math.max(0, target - value)}`}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Progress bar dla wskaźników rezultatu — dwa segmenty: żółty (noted) + zielony (achieved)
function ResultProgressBar({ noted, achieved, target }: { noted: number; achieved: number; target: number }) {
  const total = noted + achieved
  const pctNoted = target > 0 ? Math.min(100, Math.round((noted / target) * 100)) : 0
  const pctAchieved = target > 0 ? Math.min(100 - pctNoted, Math.round((achieved / target) * 100)) : 0
  const pctTotal = pctNoted + pctAchieved
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-slate-700 flex items-center gap-2">
          <span>{total} / {target}</span>
          {achieved > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {achieved} zakończonych
            </span>
          )}
          {noted > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              {noted} zanotowanych
            </span>
          )}
        </span>
        <span className={`font-medium ${pctTotal >= 100 ? "text-green-600" : "text-slate-400"}`}>
          {pctTotal >= 100 ? "✓ osiągnięty" : `brakuje: ${Math.max(0, target - total)}`}
        </span>
      </div>
      {/* Segmented bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${pctAchieved}%` }} />
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${pctNoted}%` }} />
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  code: "", name: "", type: "product" as IndicatorType,
  target_value: "", unit: "os.", auto_field: "" as string, current_value: "0", notes: ""
}

export default function IndicatorsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [indicators, setIndicators] = useState<ProjectIndicator[]>([])
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [eventsCount, setEventsCount] = useState(0)
  const [indicatorCounts, setIndicatorCounts] = useState<Record<string, IndicatorCounts>>({})
  const [loading, setLoading] = useState(true)
  const [newDialog, setNewDialog] = useState(false)
  const [editDialog, setEditDialog] = useState<ProjectIndicator | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [projectRes, indRes, partRes, evRes, piRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("project_indicators").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("participants").select("gender, age_at_start, degurba, disability, homeless, minority, employment_status, employment_detail").eq("project_id", projectId),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("participant_indicators")
        .select("indicator_id, noted, achieved")
        .in("indicator_id",
          // Will be replaced after indicators load — fetch all for project via join
          (await supabase.from("project_indicators").select("id").eq("project_id", projectId)).data?.map(i => i.id) ?? []
        ),
    ])
    setProject(projectRes.data)
    setIndicators((indRes.data ?? []) as ProjectIndicator[])
    setParticipants(partRes.data ?? [])
    setEventsCount(evRes.count ?? 0)

    // Aggregate noted/achieved per indicator_id
    const counts: Record<string, IndicatorCounts> = {}
    for (const row of piRes.data ?? []) {
      if (!counts[row.indicator_id]) counts[row.indicator_id] = { noted: 0, achieved: 0 }
      if (row.noted) counts[row.indicator_id].noted++
      if (row.achieved) counts[row.indicator_id].achieved++
    }
    setIndicatorCounts(counts)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Oblicz aktualne wartości — dla rezultatów: noted+achieved z participant_indicators
  const indicatorsWithValues = indicators.map(ind => {
    if (ind.type === "result") {
      const c = indicatorCounts[ind.id] ?? { noted: 0, achieved: 0 }
      return { ...ind, computed: c.noted + c.achieved, noted: c.noted, achieved: c.achieved }
    }
    return {
      ...ind,
      computed: ind.auto_field ? computeAutoValue(ind.auto_field, participants, eventsCount) : ind.current_value,
      noted: 0,
      achieved: 0,
    }
  })

  function openNew() { setForm(EMPTY_FORM); setNewDialog(true) }

  function openEdit(ind: ProjectIndicator) {
    setForm({
      code: ind.code ?? "", name: ind.name, type: ind.type,
      target_value: String(ind.target_value), unit: ind.unit,
      auto_field: ind.auto_field ?? "", current_value: String(ind.current_value),
      notes: ind.notes ?? "",
    })
    setEditDialog(ind)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.target_value) { toast.error("Podaj nazwę i wartość docelową"); return }
    setSaving(true)
    const payload = {
      project_id: projectId,
      code: form.code.trim() || null,
      name: form.name.trim(),
      type: form.type,
      target_value: parseFloat(form.target_value) || 0,
      unit: form.unit.trim() || "os.",
      auto_field: (form.auto_field || null) as IndicatorAutoField,
      current_value: parseFloat(form.current_value) || 0,
      notes: form.notes.trim() || null,
      sort_order: indicators.length,
    }
    if (editDialog) {
      const { error } = await supabase.from("project_indicators").update(payload).eq("id", editDialog.id)
      setSaving(false)
      if (error) { toast.error("Błąd: " + error.message); return }
      setIndicators(prev => prev.map(i => i.id === editDialog.id ? { ...i, ...payload } as ProjectIndicator : i))
      setEditDialog(null)
    } else {
      const { data, error } = await supabase.from("project_indicators").insert(payload).select().single()
      setSaving(false)
      if (error) { toast.error("Błąd: " + error.message); return }
      setIndicators(prev => [...prev, data as ProjectIndicator])
      setNewDialog(false)
    }
    toast.success("Zapisano!")
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Usunąć wskaźnik "${name}"?`)) return
    const { error } = await supabase.from("project_indicators").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setIndicators(prev => prev.filter(i => i.id !== id))
    toast.success("Usunięto.")
  }

  const byType: Record<IndicatorType, typeof indicatorsWithValues> = {
    product: indicatorsWithValues.filter(i => i.type === "product"),
    result:  indicatorsWithValues.filter(i => i.type === "result"),
    soft:    indicatorsWithValues.filter(i => i.type === "soft"),
  }

  const productTotal = byType.product.length
  const productDone = byType.product.filter(i => i.computed >= i.target_value && i.target_value > 0).length

  const FormContent = () => (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Typ wskaźnika *</Label>
          <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as IndicatorType }))}>
            <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(TYPE_CONFIG) as [IndicatorType, typeof TYPE_CONFIG[IndicatorType]][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400">{TYPE_CONFIG[form.type].desc}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kod (np. R.1)</Label>
          <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="R.1" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Jednostka</Label>
          <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="os." className="h-9 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Nazwa wskaźnika *</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Liczba osób zagrożonych ubóstwem objętych wsparciem" className="text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Wartość docelowa *</Label>
          <Input type="number" value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} placeholder="80" className="h-9 text-sm" />
        </div>
        {form.type !== "result" && (
          <div className="space-y-1">
            <Label className="text-xs">Oblicz automatycznie z bazy</Label>
            <Select value={form.auto_field} onValueChange={v => setForm(f => ({ ...f, auto_field: v ?? "" }))}>
              <SelectTrigger className="text-sm h-9"><SelectValue placeholder="— ręcznie —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— wpisz ręcznie —</SelectItem>
                {Object.entries(AUTO_FIELD_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {form.type === "result" ? (
        <p className="text-xs text-slate-400 bg-green-50 border border-green-100 rounded p-2">
          Wskaźniki rezultatu są liczone automatycznie z zanotowań/osiągnięć w tabeli uczestników (przycisk "Wskaźniki" przy każdym uczestniku).
        </p>
      ) : !form.auto_field ? (
        <div className="space-y-1">
          <Label className="text-xs">Aktualna wartość (ręczna)</Label>
          <Input type="number" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0" className="h-9 text-sm" />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label className="text-xs">Uwagi / źródło pomiaru</Label>
        <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="np. mierzony do 4 tygodni po zakończeniu udziału" className="text-sm" />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Wskaźniki projektu"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Wskaźniki" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" />Wróć do projektu
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Odśwież dane
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="w-4 h-4 mr-1" />Dodaj wskaźnik
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Wskaźniki produktu</p>
                <p className="text-2xl font-bold text-blue-600">{productDone} / {productTotal}</p>
                <p className="text-xs text-slate-400">osiągniętych</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Uczestnicy w bazie</p>
                <p className="text-2xl font-bold text-slate-800">{participants.length}</p>
                <p className="text-xs text-slate-400">załadowanych z SL</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Zdarzenia (wsparcia)</p>
                <p className="text-2xl font-bold text-slate-800">{eventsCount}</p>
                <p className="text-xs text-slate-400">łącznie w projekcie</p>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : indicators.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Target className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium">Brak wskaźników</p>
                <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                  Dodaj wskaźniki z wniosku o dofinansowanie.
                </p>
                <Button size="sm" className="mt-4" onClick={openNew}>
                  <Plus className="w-4 h-4 mr-1" />Dodaj wskaźnik
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {(["product", "result", "soft"] as IndicatorType[]).filter(t => byType[t].length > 0).map(type => {
                const cfg = TYPE_CONFIG[type]
                const items = byType[type]
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {type === "product" ? "📊" : type === "result" ? "🎯" : "💡"} Wskaźniki {cfg.label.toLowerCase()}u
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {items.length} wskaźników · {items.filter(i => i.computed >= i.target_value && i.target_value > 0).length} osiągniętych
                      </span>
                      {type === "result" && (
                        <span className="text-xs text-slate-400 ml-1">
                          · <span className="text-amber-500">■</span> zanotowane · <span className="text-green-500">■</span> zakończone
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3">
                      {items.map(ind => (
                        <Card key={ind.id} className={`border ${ind.computed >= ind.target_value && ind.target_value > 0 ? "border-green-200" : ""}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {ind.code && (
                                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{ind.code}</span>
                                  )}
                                  <span className="font-medium text-sm text-slate-800">{ind.name}</span>
                                  {ind.auto_field && (
                                    <span className="text-xs text-slate-400 italic flex items-center gap-0.5">
                                      <RefreshCw className="w-2.5 h-2.5" />{AUTO_FIELD_LABELS[ind.auto_field]?.replace("Auto: ", "")}
                                    </span>
                                  )}
                                </div>
                                {ind.notes && <p className="text-xs text-slate-400 mt-0.5">{ind.notes}</p>}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" onClick={() => openEdit(ind)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" onClick={() => handleDelete(ind.id, ind.name)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            {ind.type === "result" ? (
                              <ResultProgressBar noted={ind.noted} achieved={ind.achieved} target={ind.target_value} />
                            ) : (
                              <SimpleProgressBar value={ind.computed} target={ind.target_value} />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* New dialog */}
      <Dialog open={newDialog} onOpenChange={open => { if (!open) setNewDialog(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nowy wskaźnik</DialogTitle></DialogHeader>
          <FormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={open => { if (!open) setEditDialog(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edytuj wskaźnik</DialogTitle></DialogHeader>
          <FormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
