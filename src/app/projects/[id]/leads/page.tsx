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
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Plus, Search, Phone, Mail, MapPin, Loader2, X, ChevronRight,
  FileText, CheckSquare, Square, Clock, Bell, UserCheck, Trash2,
  Pencil, Send, ArrowRight, MessageSquare, RefreshCw, Link2,
} from "lucide-react"
import Link from "next/link"
import type { Project, LeadStatus, Reminder } from "@/lib/types"

const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  nowy:            { label: "Nowy",           color: "text-blue-700",   bg: "bg-blue-100" },
  w_kontakcie:     { label: "W kontakcie",    color: "text-amber-700",  bg: "bg-amber-100" },
  zakwalifikowany: { label: "Zakwalifikowany", color: "text-green-700", bg: "bg-green-100" },
  odrzucony:       { label: "Odrzucony",      color: "text-slate-600",  bg: "bg-slate-100" },
  uczestnik:       { label: "Uczestnik ✓",    color: "text-violet-700", bg: "bg-violet-100" },
}

type LeadRow = {
  id: string
  first_name: string
  last_name: string
  phone?: string | null
  email?: string | null
  city?: string | null
  lead_status: LeadStatus
  lead_source: string
  assigned_to?: string | null
  callback_at?: string | null
  callback_note?: string | null
  qualification_notes?: string | null
  disability: boolean
  employment_status?: string | null
  foreign_origin: boolean
  third_country_citizen: boolean
  created_at: string
  // computed
  docs_count?: number
  docs_delivered?: number
  reminders_pending?: number
}

type DocRow = {
  id: string
  name: string
  delivered: boolean
  delivered_at?: string | null
  doc_type?: { name: string; who_fills: string; applies_to: string } | null
  notes?: string | null
}

type ReminderForm = {
  remind_at_date: string
  remind_at_time: string
  all_day: boolean
  note: string
  assigned_to: string
}

const EMPTY_REMINDER: ReminderForm = {
  remind_at_date: "",
  remind_at_time: "",
  all_day: false,
  note: "",
  assigned_to: "",
}

type LeadForm = {
  first_name: string
  last_name: string
  phone: string
  email: string
  city: string
  lead_status: LeadStatus
  assigned_to: string
  disability: boolean
  employment_status: string
  foreign_origin: boolean
  third_country_citizen: boolean
  qualification_notes: string
}

const EMPTY_LEAD: LeadForm = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  city: "",
  lead_status: "nowy",
  assigned_to: "",
  disability: false,
  employment_status: "",
  foreign_origin: false,
  third_country_citizen: false,
  qualification_notes: "",
}

export default function LeadsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all")
  const [filterAssigned, setFilterAssigned] = useState("all")

  // Dialogi
  const [addDialog, setAddDialog] = useState(false)
  const [editLead, setEditLead] = useState<LeadRow | null>(null)
  const [leadForm, setLeadForm] = useState<LeadForm>(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)

  // Dialog dokumentów
  const [docsLead, setDocsLead] = useState<LeadRow | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [docTypesForProject, setDocTypesForProject] = useState<{
    id: string; name: string; who_fills: string; applies_to: string
  }[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  // Dialog przypomnień
  const [remindersLead, setRemindersLead] = useState<LeadRow | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [remindersLoading, setRemindersLoading] = useState(false)
  const [reminderForm, setReminderForm] = useState<ReminderForm>(EMPTY_REMINDER)
  const [addingReminder, setAddingReminder] = useState(false)

  // Dialog wyślij mail z dokumentami
  const [sendDocsLead, setSendDocsLead] = useState<LeadRow | null>(null)
  const [sendingDocs, setSendingDocs] = useState(false)

  // Tally sync
  const [tallyForms, setTallyForms] = useState<{ id: string; name: string; numberOfSubmissions: number }[]>([])
  const [tallyFormId, setTallyFormId] = useState<string>("")
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [tallyPanelOpen, setTallyPanelOpen] = useState(false)

  // Unikalni "assigned_to" z leadów (do filtra)
  const assignees = Array.from(new Set(leads.map(l => l.assigned_to).filter(Boolean))) as string[]

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const [projectRes, leadsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("participants")
        .select("id,first_name,last_name,phone,email,city,lead_status,lead_source,assigned_to,callback_at,callback_note,qualification_notes,disability,employment_status,foreign_origin,third_country_citizen,created_at")
        .eq("project_id", projectId)
        .eq("participation_status", "lead")
        .order("created_at", { ascending: false }),
    ])
    setProject(projectRes.data)

    const rawLeads = leadsRes.data ?? []

    // Pobierz liczniki dokumentów i przypomnień dla każdego leada
    if (rawLeads.length > 0) {
      const ids = rawLeads.map(l => l.id)
      const [docsRes, remRes] = await Promise.all([
        supabase.from("lead_documents").select("participant_id, delivered").in("participant_id", ids),
        supabase.from("reminders").select("participant_id").eq("done", false).in("participant_id", ids),
      ])
      const docsMap: Record<string, { count: number; delivered: number }> = {}
      for (const d of docsRes.data ?? []) {
        if (!docsMap[d.participant_id]) docsMap[d.participant_id] = { count: 0, delivered: 0 }
        docsMap[d.participant_id].count++
        if (d.delivered) docsMap[d.participant_id].delivered++
      }
      const remMap: Record<string, number> = {}
      for (const r of remRes.data ?? []) {
        remMap[r.participant_id] = (remMap[r.participant_id] ?? 0) + 1
      }
      setLeads(rawLeads.map(l => ({
        ...l,
        lead_status: (l.lead_status ?? "nowy") as LeadStatus,
        docs_count: docsMap[l.id]?.count ?? 0,
        docs_delivered: docsMap[l.id]?.delivered ?? 0,
        reminders_pending: remMap[l.id] ?? 0,
      })))
    } else {
      setLeads([])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Pobierz listę formularzy Tally + zapisany form_id projektu
  useEffect(() => {
    fetch("/api/leads/tally-sync")
      .then(r => r.json())
      .then(data => setTallyForms(data.items ?? []))
      .catch(() => {})
    supabase.from("projects").select("tally_form_id").eq("id", projectId).single()
      .then(({ data }) => { if (data?.tally_form_id) setTallyFormId(data.tally_form_id) })
  }, [projectId])

  // ── Filtry ──
  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    if (q && !`${l.first_name} ${l.last_name} ${l.phone ?? ""} ${l.email ?? ""} ${l.city ?? ""}`.toLowerCase().includes(q)) return false
    if (filterStatus !== "all" && l.lead_status !== filterStatus) return false
    if (filterAssigned !== "all" && l.assigned_to !== filterAssigned) return false
    return true
  })

  // ── Zapis leada ──
  async function handleSaveLead() {
    if (!leadForm.first_name.trim()) { toast.error("Podaj imię"); return }
    setSaving(true)
    const payload = {
      project_id: projectId,
      first_name: leadForm.first_name.trim(),
      last_name: leadForm.last_name.trim(),
      phone: leadForm.phone.trim() || null,
      email: leadForm.email.trim() || null,
      city: leadForm.city.trim() || null,
      lead_status: leadForm.lead_status,
      assigned_to: leadForm.assigned_to.trim() || null,
      disability: leadForm.disability,
      employment_status: leadForm.employment_status.trim() || null,
      foreign_origin: leadForm.foreign_origin,
      third_country_citizen: leadForm.third_country_citizen,
      qualification_notes: leadForm.qualification_notes.trim() || null,
      participation_status: "lead" as const,
      lead_source: "telefon",
      source: "manual" as const,
      nationality: "Obywatelstwo polskie",
      country: "Polska",
      minority: false,
      homeless: false,
      no_pesel: false,
    }
    if (editLead) {
      const { error } = await supabase.from("participants").update(payload).eq("id", editLead.id)
      setSaving(false)
      if (error) { toast.error("Błąd: " + error.message); return }
      toast.success("Zapisano")
      setEditLead(null)
    } else {
      const { error } = await supabase.from("participants").insert(payload)
      setSaving(false)
      if (error) { toast.error("Błąd: " + error.message); return }
      toast.success("Lead dodany")
      setAddDialog(false)
    }
    fetchLeads()
  }

  // ── Szybka zmiana statusu ──
  async function handleStatusChange(leadId: string, status: LeadStatus) {
    await supabase.from("participants").update({ lead_status: status }).eq("id", leadId)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lead_status: status } : l))
    // Jeśli status = 'uczestnik' → zmień participation_status
    if (status === "uczestnik") {
      await supabase.from("participants").update({ participation_status: "active" }).eq("id", leadId)
    }
  }

  // ── Dialog dokumentów ──
  async function openDocs(lead: LeadRow) {
    setDocsLead(lead)
    setDocsLoading(true)
    const [docsRes, typesRes] = await Promise.all([
      supabase
        .from("lead_documents")
        .select("id, name, delivered, delivered_at, notes, doc_type:recruitment_document_types(name, who_fills, applies_to)")
        .eq("participant_id", lead.id)
        .order("created_at"),
      supabase
        .from("recruitment_document_types")
        .select("id, name, who_fills, applies_to")
        .eq("project_id", projectId)
        .order("sort_order"),
    ])
    setDocs((docsRes.data ?? []) as unknown as DocRow[])
    setDocTypesForProject(typesRes.data ?? [])
    setDocsLoading(false)
  }

  async function toggleDocDelivered(docId: string, current: boolean) {
    const now = new Date().toISOString()
    await supabase.from("lead_documents")
      .update({ delivered: !current, delivered_at: !current ? now : null })
      .eq("id", docId)
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, delivered: !current } : d))
    setLeads(prev => prev.map(l => l.id === docsLead?.id ? {
      ...l,
      docs_delivered: !current ? (l.docs_delivered ?? 0) + 1 : (l.docs_delivered ?? 1) - 1,
    } : l))
  }

  async function addDocFromType(typeId: string, typeName: string) {
    if (!docsLead) return
    const { data } = await supabase.from("lead_documents").insert({
      participant_id: docsLead.id,
      project_id: projectId,
      doc_type_id: typeId,
      name: typeName,
      delivered: false,
    }).select("id, name, delivered, delivered_at, notes, doc_type:recruitment_document_types(name, who_fills, applies_to)").single()
    if (data) {
      setDocs(prev => [...prev, data as unknown as DocRow])
      setLeads(prev => prev.map(l => l.id === docsLead.id ? { ...l, docs_count: (l.docs_count ?? 0) + 1 } : l))
    }
  }

  // ── Dialog przypomnień ──
  async function openReminders(lead: LeadRow) {
    setRemindersLead(lead)
    setRemindersLoading(true)
    setReminderForm({
      ...EMPTY_REMINDER,
      remind_at_date: new Date().toISOString().slice(0, 10),
    })
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("participant_id", lead.id)
      .order("remind_at")
    setReminders((data ?? []) as Reminder[])
    setRemindersLoading(false)
  }

  async function addReminder() {
    if (!remindersLead || !reminderForm.remind_at_date) { toast.error("Podaj datę"); return }
    setAddingReminder(true)
    const remindAt = reminderForm.all_day
      ? `${reminderForm.remind_at_date}T00:00:00`
      : `${reminderForm.remind_at_date}T${reminderForm.remind_at_time || "08:00"}:00`
    const { data, error } = await supabase.from("reminders").insert({
      project_id: projectId,
      participant_id: remindersLead.id,
      assigned_to: reminderForm.assigned_to.trim() || "—",
      remind_at: remindAt,
      all_day: reminderForm.all_day,
      note: reminderForm.note.trim() || null,
    }).select("*").single()
    setAddingReminder(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setReminders(prev => [...prev, data as Reminder])
    setLeads(prev => prev.map(l => l.id === remindersLead.id ? {
      ...l, reminders_pending: (l.reminders_pending ?? 0) + 1,
    } : l))
    setReminderForm({ ...EMPTY_REMINDER, remind_at_date: reminderForm.remind_at_date })
    toast.success("Przypomnienie dodane")
  }

  async function markReminderDone(remId: string) {
    await supabase.from("reminders").update({ done: true, done_at: new Date().toISOString() }).eq("id", remId)
    setReminders(prev => prev.map(r => r.id === remId ? { ...r, done: true } : r))
    if (remindersLead) {
      setLeads(prev => prev.map(l => l.id === remindersLead.id ? {
        ...l, reminders_pending: Math.max(0, (l.reminders_pending ?? 1) - 1),
      } : l))
    }
  }

  // ── Tally sync ──
  async function handleTallySync() {
    if (!tallyFormId) { toast.error("Wybierz formularz Tally"); return }
    setSyncing(true)
    setSyncResult(null)
    try {
      // Zapisz form_id do projektu
      await supabase.from("projects").update({ tally_form_id: tallyFormId }).eq("id", projectId)
      // Sync
      const res = await fetch("/api/leads/tally-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, form_id: tallyFormId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Błąd sync")
      setSyncResult(json)
      if (json.imported > 0) {
        toast.success(`Zaimportowano ${json.imported} nowych leadów`)
        fetchLeads()
      } else {
        toast.info("Brak nowych zgłoszeń")
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSyncing(false)
    }
  }

  // ── Wyślij mail z dokumentami ──
  async function handleSendDocs() {
    if (!sendDocsLead?.email) { toast.error("Brak adresu email leada"); return }
    setSendingDocs(true)
    try {
      const res = await fetch("/api/leads/send-docs-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: sendDocsLead.id, projectId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Błąd wysyłki")
      toast.success("Mail wysłany!")
      setSendDocsLead(null)
      fetchLeads()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSendingDocs(false)
    }
  }

  function openEdit(lead: LeadRow) {
    setLeadForm({
      first_name: lead.first_name,
      last_name: lead.last_name ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      city: lead.city ?? "",
      lead_status: lead.lead_status,
      assigned_to: lead.assigned_to ?? "",
      disability: lead.disability ?? false,
      employment_status: lead.employment_status ?? "",
      foreign_origin: lead.foreign_origin ?? false,
      third_country_citizen: lead.third_country_citizen ?? false,
      qualification_notes: lead.qualification_notes ?? "",
    })
    setEditLead(lead)
  }

  const counts = {
    nowy: leads.filter(l => l.lead_status === "nowy").length,
    w_kontakcie: leads.filter(l => l.lead_status === "w_kontakcie").length,
    zakwalifikowany: leads.filter(l => l.lead_status === "zakwalifikowany").length,
    odrzucony: leads.filter(l => l.lead_status === "odrzucony").length,
    uczestnik: leads.filter(l => l.lead_status === "uczestnik").length,
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Leady rekrutacyjne"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Leady" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Statystyki statusów */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(LEAD_STATUS_CONFIG) as [LeadStatus, typeof LEAD_STATUS_CONFIG[LeadStatus]][]).map(([status, cfg]) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterStatus === status
                    ? `${cfg.bg} ${cfg.color} border-current shadow-sm`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {cfg.label} <span className="ml-1 opacity-70">{counts[status]}</span>
              </button>
            ))}
            {filterStatus !== "all" && (
              <button type="button" onClick={() => setFilterStatus("all")} className="text-xs text-slate-400 hover:text-slate-600 px-2">
                × Wyczyść filtr
              </button>
            )}
          </div>

          {/* Pasek narzędzi */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj po imieniu, tel, email, mieście…"
                className="pl-9"
              />
            </div>
            {assignees.length > 0 && (
              <Select value={filterAssigned} onValueChange={v => setFilterAssigned(v ?? "all")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Przypisany" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy</SelectItem>
                  {assignees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => { setLeadForm(EMPTY_LEAD); setAddDialog(true) }}>
              <Plus className="w-4 h-4 mr-1" /> Dodaj lead
            </Button>
          </div>

          {/* Panel Tally */}
          <div className="border rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setTallyPanelOpen(p => !p)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              <Link2 className="w-4 h-4 text-slate-400" />
              <span>Synchronizacja z Tally.so</span>
              {tallyFormId && tallyForms.length > 0 && (
                <span className="text-xs text-slate-400 ml-1">
                  · {tallyForms.find(f => f.id === tallyFormId)?.name ?? tallyFormId}
                </span>
              )}
              <span className="ml-auto text-slate-400 text-xs">{tallyPanelOpen ? "▲" : "▼"}</span>
            </button>
            {tallyPanelOpen && (
              <div className="px-4 pb-4 border-t pt-3 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-48">
                  <Label className="text-xs mb-1 block">Formularz Tally</Label>
                  <Select value={tallyFormId} onValueChange={v => setTallyFormId(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz formularz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tallyForms.filter(f => f.numberOfSubmissions > 0).map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} <span className="text-slate-400">({f.numberOfSubmissions} zgłoszeń)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleTallySync} disabled={syncing || !tallyFormId}>
                  {syncing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Synchronizuję…</>
                    : <><RefreshCw className="w-4 h-4 mr-2" />Synchronizuj teraz</>
                  }
                </Button>
                {syncResult && (
                  <p className="text-xs text-slate-500">
                    Ostatni sync: <strong>{syncResult.imported}</strong> nowych, {syncResult.skipped} pominiętych
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                {leads.length === 0 ? "Brak leadów. Dodaj pierwszego lub skonfiguruj webhook Tally." : "Brak wyników dla wybranych filtrów."}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Osoba</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Kontakt</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cechy</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Przypisany</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Dokumenty</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(lead => {
                    const cfg = LEAD_STATUS_CONFIG[lead.lead_status]
                    const hasCallback = lead.callback_at && new Date(lead.callback_at) > new Date()
                    const callbackOverdue = lead.callback_at && new Date(lead.callback_at) <= new Date()
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        {/* Osoba */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {lead.first_name} {lead.last_name}
                          </div>
                          {lead.city && (
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />{lead.city}
                            </div>
                          )}
                          <div className="text-xs text-slate-300 mt-0.5">
                            {new Date(lead.created_at).toLocaleDateString("pl-PL")}
                            {lead.lead_source !== "telefon" && (
                              <span className="ml-1 opacity-70">· {lead.lead_source}</span>
                            )}
                          </div>
                        </td>

                        {/* Kontakt */}
                        <td className="px-4 py-3">
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                              <Phone className="w-3 h-3" />{lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 text-xs mt-0.5">
                              <Mail className="w-3 h-3" />{lead.email}
                            </a>
                          )}
                          {(hasCallback || callbackOverdue) && (
                            <div className={`flex items-center gap-1 text-xs mt-1 ${callbackOverdue ? "text-red-600 font-medium" : "text-amber-600"}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(lead.callback_at!).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </td>

                        {/* Status — dropdown */}
                        <td className="px-4 py-3">
                          <Select
                            value={lead.lead_status}
                            onValueChange={v => handleStatusChange(lead.id, v as LeadStatus)}
                          >
                            <SelectTrigger className={`h-7 text-xs font-semibold w-36 border-0 ${cfg.bg} ${cfg.color}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(LEAD_STATUS_CONFIG) as [LeadStatus, typeof LEAD_STATUS_CONFIG[LeadStatus]][]).map(([s, c]) => (
                                <SelectItem key={s} value={s}>
                                  <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Cechy kwalifikacyjne */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {lead.disability && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Niepełnospr.</span>
                            )}
                            {lead.employment_status?.toLowerCase().includes("bezrobot") && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">Bezrobotny</span>
                            )}
                            {lead.employment_status?.toLowerCase().includes("długotrwale") && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">Dług. bezrobot.</span>
                            )}
                            {lead.employment_status?.toLowerCase().includes("bier") && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600">Bierny</span>
                            )}
                            {lead.third_country_citizen && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">UKR</span>
                            )}
                          </div>
                          {lead.qualification_notes && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{lead.qualification_notes}</p>
                          )}
                        </td>

                        {/* Przypisany */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 font-mono">{lead.assigned_to ?? "—"}</span>
                          {(lead.reminders_pending ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => openReminders(lead)}
                              className="ml-2 inline-flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full hover:bg-amber-200"
                            >
                              <Bell className="w-3 h-3" />{lead.reminders_pending}
                            </button>
                          )}
                        </td>

                        {/* Dokumenty */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDocs(lead)}
                            className="flex items-center gap-1.5 text-xs hover:text-blue-600 transition-colors"
                          >
                            <FileText className="w-4 h-4 text-slate-400" />
                            {(lead.docs_count ?? 0) > 0 ? (
                              <span className={`font-medium ${lead.docs_delivered === lead.docs_count ? "text-green-600" : "text-slate-600"}`}>
                                {lead.docs_delivered}/{lead.docs_count}
                              </span>
                            ) : (
                              <span className="text-slate-400">Dodaj</span>
                            )}
                          </button>
                        </td>

                        {/* Akcje */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Edytuj"
                              onClick={() => openEdit(lead)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Przypomnienia / obdzwonka"
                              onClick={() => openReminders(lead)}
                              className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </button>
                            {lead.email && (
                              <button
                                type="button"
                                title="Wyślij mail z dokumentami"
                                onClick={() => setSendDocsLead(lead)}
                                className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* ── Dialog dodaj/edytuj lead ── */}
      <Dialog open={addDialog || !!editLead} onOpenChange={open => { if (!open) { setAddDialog(false); setEditLead(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editLead ? "Edytuj lead" : "Dodaj lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Imię *</Label>
                <Input value={leadForm.first_name} onChange={e => setLeadForm(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div>
                <Label>Nazwisko</Label>
                <Input value={leadForm.last_name} onChange={e => setLeadForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefon</Label>
                <Input value={leadForm.phone} onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))} placeholder="np. 600 000 000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={leadForm.email} onChange={e => setLeadForm(p => ({ ...p, email: e.target.value }))} type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Miejscowość</Label>
                <Input value={leadForm.city} onChange={e => setLeadForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <Label>Przypisany (inicjały)</Label>
                <Input value={leadForm.assigned_to} onChange={e => setLeadForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="np. BK, GK" />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={leadForm.lead_status} onValueChange={v => setLeadForm(p => ({ ...p, lead_status: (v ?? "nowy") as LeadStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(LEAD_STATUS_CONFIG) as [LeadStatus, typeof LEAD_STATUS_CONFIG[LeadStatus]][]).map(([s, c]) => (
                    <SelectItem key={s} value={s}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status zatrudnienia</Label>
              <Select value={leadForm.employment_status} onValueChange={v => setLeadForm(p => ({ ...p, employment_status: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bezrobotny_zarejestrowany">Bezrobotny – zarejestrowany w UP</SelectItem>
                  <SelectItem value="bezrobotny_niezarejestrowany">Bezrobotny – niezarejestrowany</SelectItem>
                  <SelectItem value="dlugoterwale_bezrobotny">Długotrwale bezrobotny</SelectItem>
                  <SelectItem value="bierny_zawodowo">Bierny zawodowo</SelectItem>
                  <SelectItem value="pracujacy">Pracujący</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={leadForm.disability} onChange={e => setLeadForm(p => ({ ...p, disability: e.target.checked }))} />
                Niepełnosprawność
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={leadForm.third_country_citizen} onChange={e => setLeadForm(p => ({ ...p, third_country_citizen: e.target.checked }))} />
                Status UKR
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={leadForm.foreign_origin} onChange={e => setLeadForm(p => ({ ...p, foreign_origin: e.target.checked }))} />
                Obcokrajowiec
              </label>
            </div>
            <div>
              <Label>Notatki z kwalifikacji</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={leadForm.qualification_notes}
                onChange={e => setLeadForm(p => ({ ...p, qualification_notes: e.target.value }))}
                placeholder="Notatki z rozmowy telefonicznej, dodatkowe informacje..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialog(false); setEditLead(null) }}>Anuluj</Button>
            <Button onClick={handleSaveLead} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog dokumentów leada ── */}
      <Dialog open={!!docsLead} onOpenChange={open => { if (!open) setDocsLead(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Dokumenty — {docsLead?.first_name} {docsLead?.last_name}
            </DialogTitle>
          </DialogHeader>
          {docsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-3 py-2">
              {docs.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Brak dokumentów. Dodaj z listy poniżej.</p>
              )}
              {docs.map(doc => (
                <div key={doc.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <button
                    type="button"
                    onClick={() => toggleDocDelivered(doc.id, doc.delivered)}
                    className={`mt-0.5 flex-shrink-0 ${doc.delivered ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
                  >
                    {doc.delivered ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${doc.delivered ? "text-green-700" : "text-slate-700"}`}>
                      {doc.name}
                    </p>
                    {doc.doc_type && (
                      <p className="text-xs text-slate-400">
                        {doc.doc_type.who_fills === "zus" ? "→ ZUS" :
                         doc.doc_type.who_fills === "up" ? "→ Urząd Pracy" :
                         doc.doc_type.who_fills === "ops" ? "→ OPS/GOPS" :
                         doc.doc_type.who_fills === "my" ? "→ my wysyłamy" : "→ uczestnik"}
                        {" · "}
                        {doc.doc_type.applies_to === "wszyscy" ? "wszyscy" : doc.doc_type.applies_to}
                      </p>
                    )}
                    {doc.delivered && doc.delivered_at && (
                      <p className="text-xs text-green-500">
                        ✓ {new Date(doc.delivered_at).toLocaleDateString("pl-PL")}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Dodaj z szablonu */}
              {docTypesForProject.filter(dt => !docs.find(d => d.doc_type?.name === dt.name)).length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-slate-400 mb-2">Dodaj dokument z listy:</p>
                  <div className="space-y-1">
                    {docTypesForProject
                      .filter(dt => !docs.find(d => d.doc_type?.name === dt.name))
                      .map(dt => (
                        <button
                          key={dt.id}
                          type="button"
                          onClick={() => addDocFromType(dt.id, dt.name)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-blue-50 text-slate-600 hover:text-blue-700"
                        >
                          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                          {dt.name}
                          <span className="ml-auto text-xs text-slate-400">
                            {dt.applies_to === "wszyscy" ? "wszyscy" : dt.applies_to}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocsLead(null)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog przypomnień / obdzwonka ── */}
      <Dialog open={!!remindersLead} onOpenChange={open => { if (!open) setRemindersLead(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Bell className="inline w-4 h-4 mr-1 mb-0.5" />
              Obdzwonka — {remindersLead?.first_name} {remindersLead?.last_name}
            </DialogTitle>
          </DialogHeader>
          {remindersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Historia przypomnień */}
              {reminders.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reminders.map(rem => (
                    <div key={rem.id} className={`flex items-start gap-3 p-2 rounded-lg border ${rem.done ? "opacity-50 bg-slate-50" : "bg-white border-amber-200"}`}>
                      <button
                        type="button"
                        onClick={() => !rem.done && markReminderDone(rem.id)}
                        className={`mt-0.5 flex-shrink-0 ${rem.done ? "text-green-500" : "text-amber-500 hover:text-green-500"}`}
                      >
                        {rem.done ? <CheckSquare className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                          {rem.all_day
                            ? new Date(rem.remind_at).toLocaleDateString("pl-PL")
                            : new Date(rem.remind_at).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          }
                          <span className="ml-2 font-mono text-slate-400">{rem.assigned_to}</span>
                        </p>
                        {rem.note && <p className="text-xs text-slate-500 mt-0.5">{rem.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dodaj nowe przypomnienie */}
              <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600">Dodaj przypomnienie</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={reminderForm.remind_at_date}
                      onChange={e => setReminderForm(p => ({ ...p, remind_at_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Godzina</Label>
                    <Input
                      type="time"
                      value={reminderForm.remind_at_time}
                      disabled={reminderForm.all_day}
                      onChange={e => setReminderForm(p => ({ ...p, remind_at_time: e.target.value }))}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderForm.all_day}
                    onChange={e => setReminderForm(p => ({ ...p, all_day: e.target.checked }))}
                  />
                  Cały dzień (bez konkretnej godziny)
                </label>
                <div>
                  <Label className="text-xs">Inicjały (kto dzwoni)</Label>
                  <Input
                    value={reminderForm.assigned_to}
                    onChange={e => setReminderForm(p => ({ ...p, assigned_to: e.target.value }))}
                    placeholder="np. BK"
                  />
                </div>
                <div>
                  <Label className="text-xs">Notatka</Label>
                  <Input
                    value={reminderForm.note}
                    onChange={e => setReminderForm(p => ({ ...p, note: e.target.value }))}
                    placeholder="np. prosił zadzwonić po 14:00, nie odebrał"
                  />
                </div>
                <Button size="sm" onClick={addReminder} disabled={addingReminder} className="w-full">
                  {addingReminder && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Dodaj przypomnienie
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemindersLead(null)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog wyślij mail z dokumentami ── */}
      <Dialog open={!!sendDocsLead} onOpenChange={open => { if (!open) setSendDocsLead(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Wyślij mail z dokumentami</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-slate-600">
            <p>Mail zostanie wysłany na: <strong>{sendDocsLead?.email}</strong></p>
            <p className="text-xs text-slate-400">
              Mail zawiera informacje o wymaganych dokumentach rekrutacyjnych oraz instrukcję ich dostarczenia.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDocsLead(null)}>Anuluj</Button>
            <Button onClick={handleSendDocs} disabled={sendingDocs}>
              {sendingDocs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Wyślij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
