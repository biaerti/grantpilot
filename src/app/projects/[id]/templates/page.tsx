"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  FileText, Plus, Trash2, Upload, Loader2, ChevronDown, ChevronRight,
  Download, Sparkles, Tag, UserPlus, Check,
} from "lucide-react"
import type { Project, DocumentType, DocumentCategory } from "@/lib/types"

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

interface TaskOption {
  id: string
  number: number
  name: string
  budget_lines: { id: string; sub_number?: string | null; name: string }[]
}

interface BudgetLineMin {
  id: string
  task_id: string
  sub_number?: string
  name: string
}

// ─────────────────────────────────────────────
// Document templates config
// ─────────────────────────────────────────────

const PARTICIPANT_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "first_name",         label: "Imię",                           group: "Dane osobowe" },
  { key: "last_name",          label: "Nazwisko",                       group: "Dane osobowe" },
  { key: "pesel",              label: "PESEL",                          group: "Dane osobowe" },
  { key: "gender",             label: "Płeć",                           group: "Dane osobowe" },
  { key: "age_at_start",       label: "Wiek (w chwili przystąpienia)",  group: "Dane osobowe" },
  { key: "nationality",        label: "Obywatelstwo",                   group: "Dane osobowe" },
  { key: "email",              label: "Email",                          group: "Kontakt" },
  { key: "phone",              label: "Telefon",                        group: "Kontakt" },
  { key: "city",               label: "Miejscowość",                    group: "Adres" },
  { key: "county",             label: "Powiat",                         group: "Adres" },
  { key: "commune",            label: "Gmina",                          group: "Adres" },
  { key: "voivodeship",        label: "Województwo",                    group: "Adres" },
  { key: "postal_code",        label: "Kod pocztowy",                   group: "Adres" },
  { key: "education_level",    label: "Wykształcenie",                  group: "Projekt" },
  { key: "employment_status",  label: "Status na rynku pracy",          group: "Projekt" },
  { key: "support_start_date", label: "Data rozpoczęcia wsparcia",      group: "Projekt" },
  { key: "project_start_date", label: "Data przystąpienia do projektu", group: "Projekt" },
]

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; color: string; icon: string; hasVariables: boolean }> = {
  deklaracja:          { label: "Deklaracja",          color: "bg-blue-100 text-blue-700",    icon: "📋", hasVariables: true },
  formularz_online:    { label: "Formularz online",    color: "bg-violet-100 text-violet-700", icon: "🌐", hasVariables: true },
  formularz_papierowy: { label: "Formularz papierowy", color: "bg-slate-100 text-slate-700",  icon: "📄", hasVariables: false },
  rodo:                { label: "Zgody RODO",          color: "bg-orange-100 text-orange-700", icon: "🔒", hasVariables: false },
  pretest:             { label: "Pretest",             color: "bg-amber-100 text-amber-700",  icon: "📝", hasVariables: false },
  posttest:            { label: "Posttest",            color: "bg-green-100 text-green-700",  icon: "✅", hasVariables: false },
  certyfikat:          { label: "Certyfikat",          color: "bg-yellow-100 text-yellow-700", icon: "🏆", hasVariables: true },
  inne:                { label: "Inne",                color: "bg-gray-100 text-gray-600",    icon: "📁", hasVariables: false },
  protokol:            { label: "Protokół",            color: "bg-teal-100 text-teal-700",    icon: "📝", hasVariables: true },
  umowa_indywidualna:  { label: "Umowa indywidualna",  color: "bg-indigo-100 text-indigo-700", icon: "📑", hasVariables: true },
  umowa_grupowa:       { label: "Umowa grupowa",       color: "bg-purple-100 text-purple-700", icon: "📃", hasVariables: true },
}

// Pola dostępne jako zmienne w protokołach
const PROTOCOL_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "contractor_name",   label: "Nazwa wykonawcy",    group: "Wykonawca" },
  { key: "contractor_nip",    label: "NIP wykonawcy",      group: "Wykonawca" },
  { key: "contractor_address",label: "Adres wykonawcy",    group: "Wykonawca" },
  { key: "contract_name",     label: "Nazwa umowy",        group: "Umowa" },
  { key: "contract_amount",   label: "Kwota umowy",        group: "Umowa" },
  { key: "contract_scope",    label: "Zakres umowy",       group: "Umowa" },
  { key: "date_from",         label: "Data od",            group: "Umowa" },
  { key: "date_to",           label: "Data do",            group: "Umowa" },
  { key: "settlement_month",  label: "Miesiąc rozliczenia",group: "Rozliczenie" },
  { key: "settlement_amount", label: "Kwota do rozliczenia",group: "Rozliczenie" },
  { key: "project_name",      label: "Nazwa projektu",     group: "Projekt" },
  { key: "project_number",    label: "Numer projektu",     group: "Projekt" },
]

// Pola dla umowy indywidualnej (z wykonawcą – bez danych uczestnika, z liczbą godzin)
const CONTRACT_INDIVIDUAL_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "contractor_name",    label: "Nazwa wykonawcy",          group: "Wykonawca" },
  { key: "contractor_nip",     label: "NIP wykonawcy",            group: "Wykonawca" },
  { key: "contractor_address", label: "Adres wykonawcy",          group: "Wykonawca" },
  { key: "contract_name",      label: "Nazwa umowy",              group: "Umowa" },
  { key: "contract_number",    label: "Numer umowy",              group: "Umowa" },
  { key: "contract_scope",     label: "Zakres umowy",             group: "Umowa" },
  { key: "hours_total",        label: "Liczba godzin",            group: "Umowa" },
  { key: "date_from",          label: "Data od",                  group: "Umowa" },
  { key: "date_to",            label: "Data do",                  group: "Umowa" },
  { key: "task_name",          label: "Nazwa zadania",            group: "Projekt" },
  { key: "budget_line_name",   label: "Podzadanie budżetowe",     group: "Projekt" },
  { key: "project_name",       label: "Nazwa projektu",           group: "Projekt" },
  { key: "project_number",     label: "Numer projektu",           group: "Projekt" },
]

// Pola dla umowy grupowej (szkolenie/kurs dla grupy – z liczbą osób, bez rozbicia na uczestników)
const CONTRACT_GROUP_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "contractor_name",    label: "Nazwa wykonawcy",          group: "Wykonawca" },
  { key: "contractor_nip",     label: "NIP wykonawcy",            group: "Wykonawca" },
  { key: "contractor_address", label: "Adres wykonawcy",          group: "Wykonawca" },
  { key: "contract_name",      label: "Nazwa umowy",              group: "Umowa" },
  { key: "contract_number",    label: "Numer umowy",              group: "Umowa" },
  { key: "contract_scope",     label: "Zakres umowy",             group: "Umowa" },
  { key: "group_size",         label: "Liczba uczestników",       group: "Umowa" },
  { key: "date_from",          label: "Data szkolenia (od)",      group: "Umowa" },
  { key: "date_to",            label: "Data szkolenia (do)",      group: "Umowa" },
  { key: "task_name",          label: "Nazwa zadania",            group: "Projekt" },
  { key: "budget_line_name",   label: "Podzadanie budżetowe",     group: "Projekt" },
  { key: "project_name",       label: "Nazwa projektu",           group: "Projekt" },
  { key: "project_number",     label: "Numer projektu",           group: "Projekt" },
]


const DEFAULT_VARIABLES: Record<DocumentCategory, { key: string; label: string }[]> = {
  deklaracja:          [{ key: "first_name", label: "Imię" }, { key: "last_name", label: "Nazwisko" }],
  certyfikat:          [{ key: "first_name", label: "Imię" }, { key: "last_name", label: "Nazwisko" }],
  formularz_online:    [
    { key: "first_name", label: "Imię" },
    { key: "last_name", label: "Nazwisko" },
    { key: "pesel", label: "PESEL" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefon" },
  ],
  formularz_papierowy: [],
  rodo:                [],
  pretest:             [],
  posttest:            [],
  inne:                [],
  protokol:            PROTOCOL_FIELDS.map(f => ({ key: f.key, label: f.label })),
  // Umowa indywidualna – wszystkie pola domyślnie zaznaczone; bez danych osobowych uczestnika
  umowa_indywidualna:  CONTRACT_INDIVIDUAL_FIELDS.map(f => ({ key: f.key, label: f.label })),
  // Umowa grupowa – wszystkie pola domyślnie zaznaczone; z liczbą osób zamiast danych uczestnika
  umowa_grupowa:       CONTRACT_GROUP_FIELDS.map(f => ({ key: f.key, label: f.label })),
}

const CATEGORY_ORDER: DocumentCategory[] = [
  "deklaracja", "formularz_online", "formularz_papierowy", "rodo", "pretest", "posttest", "certyfikat", "inne",
]

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function TemplatesPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Shared data
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [allBudgetLines, setAllBudgetLines] = useState<BudgetLineMin[]>([])

  // ── Document templates state ──
  const [docTemplates, setDocTemplates] = useState<DocumentType[]>([])
  const [docExpanded, setDocExpanded] = useState<Set<string>>(new Set())
  const [generateDialog, setGenerateDialog] = useState<DocumentType | null>(null)
  const [participants, setParticipants] = useState<{ id: string; first_name: string; last_name: string; pesel?: string | null }[]>([])
  const [selectedParticipantId, setSelectedParticipantId] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatedSet, setGeneratedSet] = useState<Set<string>>(new Set())
  const [newDocDialog, setNewDocDialog] = useState(false)
  const [docSaving, setDocSaving] = useState(false)
  const [docForm, setDocForm] = useState({
    category: "deklaracja" as DocumentCategory,
    name: "",
    required: false,
    taskScoped: false,
    task_id: "",
    budget_line_id: "",
    notes: "",
  })
  const [docVariables, setDocVariables] = useState<{ key: string; label: string }[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Protocol templates state ──
  const [protoTemplates, setProtoTemplates] = useState<DocumentType[]>([])
  const [newProtoDialog, setNewProtoDialog] = useState(false)
  const [protoSaving, setProtoSaving] = useState(false)
  const [protoForm, setProtoForm] = useState({ name: "Protokół odbioru" })
  const [protoVariables, setProtoVariables] = useState<{ key: string; label: string }[]>(DEFAULT_VARIABLES.protokol)
  const protoFileRef = useRef<HTMLInputElement>(null)
  const [pendingProtoFile, setPendingProtoFile] = useState<File | null>(null)

  // ── Contract templates state ──
  const [contractTemplates, setContractTemplates] = useState<DocumentType[]>([])
  const [newContractDialog, setNewContractDialog] = useState(false)
  const [contractTmplType, setContractTmplType] = useState<"umowa_indywidualna" | "umowa_grupowa">("umowa_indywidualna")
  const [contractTmplName, setContractTmplName] = useState("Umowa zlecenia")
  const [contractTmplVariables, setContractTmplVariables] = useState<{ key: string; label: string }[]>(DEFAULT_VARIABLES.umowa_indywidualna)
  const [contractTmplSaving, setContractTmplSaving] = useState(false)
  const contractTmplFileRef = useRef<HTMLInputElement>(null)
  const [pendingContractTmplFile, setPendingContractTmplFile] = useState<File | null>(null)

  // Active tab (keep in sync with ?tab= param for direct links)
  const defaultTab = searchParams.get("tab") ?? "documents"

  useEffect(() => { fetchAll() }, [projectId])

  // Auto-reset document form variables when category changes
  useEffect(() => {
    const cfg = CATEGORY_CONFIG[docForm.category]
    setDocVariables(cfg.hasVariables ? (DEFAULT_VARIABLES[docForm.category] ?? []) : [])
  }, [docForm.category])

  useEffect(() => {
    if (!docForm.name) setDocForm(f => ({ ...f, name: CATEGORY_CONFIG[f.category].label }))
  }, [docForm.category])

  async function fetchAll() {
    setLoading(true)
    const [projectRes, allTemplatesRes, tasksRes, linesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("document_types").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("tasks").select("id, number, name, budget_lines(id, sub_number, name)").eq("project_id", projectId).order("number"),
      supabase.from("budget_lines").select("id, task_id, sub_number, name").eq("project_id", projectId),
    ])
    setProject(projectRes.data)
    const allTmpl = (allTemplatesRes.data ?? []) as DocumentType[]
    const CONTRACT_CATS = ["umowa_indywidualna", "umowa_grupowa"]
    setDocTemplates(allTmpl.filter(t => t.category !== "protokol" && !CONTRACT_CATS.includes(t.category)))
    setProtoTemplates(allTmpl.filter(t => t.category === "protokol"))
    setContractTemplates(allTmpl.filter(t => CONTRACT_CATS.includes(t.category)))
    setTasks((tasksRes.data ?? []) as unknown as TaskOption[])
    setAllBudgetLines(linesRes.data ?? [])
    setLoading(false)
  }

  // ── Document template handlers ──

  function openNewDoc() {
    setDocForm({ category: "deklaracja", name: CATEGORY_CONFIG.deklaracja.label, required: false, taskScoped: false, task_id: "", budget_line_id: "", notes: "" })
    setDocVariables(DEFAULT_VARIABLES.deklaracja)
    setPendingFile(null)
    setNewDocDialog(true)
  }

  async function handleSaveDoc() {
    if (!docForm.name.trim()) { toast.error("Podaj nazwę szablonu"); return }
    setDocSaving(true)
    let file_url: string | null = null
    let file_name: string | null = null
    if (pendingFile) {
      const storagePath = `${projectId}/templates/${Date.now()}_${pendingFile.name}`
      const { error: upErr } = await supabase.storage.from("participant-documents").upload(storagePath, pendingFile, { upsert: false })
      if (upErr) { toast.error("Błąd uploadu: " + upErr.message); setDocSaving(false); return }
      const { data: urlData } = supabase.storage.from("participant-documents").getPublicUrl(storagePath)
      file_url = urlData.publicUrl
      file_name = pendingFile.name
    }
    const { data, error } = await supabase.from("document_types").insert({
      project_id: projectId,
      name: docForm.name.trim(),
      category: docForm.category,
      required: docForm.required,
      task_id: docForm.taskScoped && docForm.task_id ? docForm.task_id : null,
      budget_line_id: docForm.taskScoped && docForm.budget_line_id ? docForm.budget_line_id : null,
      variables: CATEGORY_CONFIG[docForm.category].hasVariables ? docVariables : [],
      description: docForm.notes.trim() || null,
      sort_order: docTemplates.length,
      ...(file_url ? { description: JSON.stringify({ notes: docForm.notes, file_url, file_name }) } : {}),
    }).select().single()
    setDocSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setDocTemplates(prev => [...prev, data as DocumentType])
    setNewDocDialog(false)
    toast.success("Szablon dodany!")
  }

  async function handleDeleteDoc(id: string) {
    if (!confirm("Usunąć ten szablon dokumentu?")) return
    const { error } = await supabase.from("document_types").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setDocTemplates(prev => prev.filter(t => t.id !== id))
    toast.success("Usunięto.")
  }

  async function openGenerateDialog(tmpl: DocumentType) {
    setGenerateDialog(tmpl)
    setSelectedParticipantId("")
    setGeneratedSet(new Set())
    if (participants.length === 0) {
      const { data } = await supabase.from("participants").select("id, first_name, last_name, pesel").eq("project_id", projectId).order("last_name")
      setParticipants(data ?? [])
    }
  }

  async function handleGenerate() {
    if (!generateDialog || !selectedParticipantId) return
    setGenerating(true)
    const p = participants.find(px => px.id === selectedParticipantId)
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_type_id: generateDialog.id, participant_id: selectedParticipantId, project_id: projectId }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error("Błąd generowania: " + (json.error ?? res.statusText)); return }
      setGeneratedSet(prev => new Set([...prev, selectedParticipantId]))
      toast.success(`Wygenerowano dla ${p?.first_name} ${p?.last_name}!`)
      setSelectedParticipantId("")
    } finally { setGenerating(false) }
  }

  // ── Protocol handlers ──

  function openNewProto() {
    setProtoForm({ name: "Protokół odbioru" })
    setProtoVariables(DEFAULT_VARIABLES.protokol)
    setPendingProtoFile(null)
    setNewProtoDialog(true)
  }

  async function handleSaveProto() {
    if (!protoForm.name.trim()) { toast.error("Podaj nazwę szablonu"); return }
    setProtoSaving(true)
    let file_url: string | null = null
    let file_name: string | null = null
    if (pendingProtoFile) {
      const storagePath = `${projectId}/templates/${Date.now()}_${pendingProtoFile.name}`
      const { error: upErr } = await supabase.storage.from("participant-documents").upload(storagePath, pendingProtoFile, { upsert: false })
      if (upErr) { toast.error("Błąd uploadu: " + upErr.message); setProtoSaving(false); return }
      const { data: urlData } = supabase.storage.from("participant-documents").getPublicUrl(storagePath)
      file_url = urlData.publicUrl
      file_name = pendingProtoFile.name
    }
    const { data, error } = await supabase.from("document_types").insert({
      project_id: projectId,
      name: protoForm.name.trim(),
      category: "protokol",
      required: false,
      variables: protoVariables,
      sort_order: protoTemplates.length,
      ...(file_url ? { description: JSON.stringify({ file_url, file_name }) } : {}),
    }).select().single()
    setProtoSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setProtoTemplates(prev => [...prev, data as DocumentType])
    setNewProtoDialog(false)
    toast.success("Szablon protokołu dodany!")
  }

  async function handleDeleteProto(id: string) {
    if (!confirm("Usunąć ten szablon protokołu?")) return
    const { error } = await supabase.from("document_types").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setProtoTemplates(prev => prev.filter(t => t.id !== id))
    toast.success("Usunięto.")
  }

  // ── Contract template handlers ──

  function openNewContractTmpl() {
    setContractTmplType("umowa_indywidualna")
    setContractTmplName("Umowa zlecenia")
    setContractTmplVariables(DEFAULT_VARIABLES.umowa_indywidualna)
    setPendingContractTmplFile(null)
    setNewContractDialog(true)
  }

  async function handleSaveContractTmpl() {
    if (!contractTmplName.trim()) { toast.error("Podaj nazwę szablonu"); return }
    setContractTmplSaving(true)
    let file_url: string | null = null
    let file_name: string | null = null
    if (pendingContractTmplFile) {
      const storagePath = `${projectId}/templates/${Date.now()}_${pendingContractTmplFile.name}`
      const { error: upErr } = await supabase.storage.from("participant-documents").upload(storagePath, pendingContractTmplFile, { upsert: false })
      if (upErr) { toast.error("Błąd uploadu: " + upErr.message); setContractTmplSaving(false); return }
      const { data: urlData } = supabase.storage.from("participant-documents").getPublicUrl(storagePath)
      file_url = urlData.publicUrl
      file_name = pendingContractTmplFile.name
    }
    const { data, error } = await supabase.from("document_types").insert({
      project_id: projectId,
      name: contractTmplName.trim(),
      category: contractTmplType,
      required: false,
      variables: contractTmplVariables,
      sort_order: contractTemplates.length,
      ...(file_url ? { description: JSON.stringify({ file_url, file_name }) } : {}),
    }).select().single()
    setContractTmplSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContractTemplates(prev => [...prev, data as DocumentType])
    setNewContractDialog(false)
    toast.success("Szablon umowy dodany!")
  }

  async function handleDeleteContractTmpl(id: string) {
    if (!confirm("Usunąć ten szablon umowy?")) return
    const { error } = await supabase.from("document_types").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setContractTemplates(prev => prev.filter(t => t.id !== id))
    toast.success("Usunięto.")
  }

  // ── Render helpers ──

  const byCategory = docTemplates.reduce((acc, t) => {
    const cat = (t.category as DocumentCategory) ?? "inne"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<DocumentCategory, DocumentType[]>)

  const selectedDocTask = tasks.find(t => t.id === docForm.task_id)

  // ─────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Szablony"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Szablony" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="documents">Dokumenty rekrutacyjne</TabsTrigger>
                <TabsTrigger value="protocols">Protokoły</TabsTrigger>
                <TabsTrigger value="contracts">Umowy</TabsTrigger>
              </TabsList>

              {/* ── Dokumenty rekrutacyjne ── */}
              <TabsContent value="documents" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Szablony dokumentów projektu. Z każdego szablonu możesz generować dokumenty dla uczestników.
                  </p>
                  <Button size="sm" onClick={openNewDoc}>
                    <Plus className="w-4 h-4 mr-1" />Nowy szablon
                  </Button>
                </div>

                {/* Legenda */}
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ORDER.map(cat => {
                    const cfg = CATEGORY_CONFIG[cat]
                    return (
                      <span key={cat} className={`text-xs px-2 py-1 rounded-full ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    )
                  })}
                </div>

                {docTemplates.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                      <p className="text-slate-500 font-medium">Brak szablonów</p>
                      <p className="text-slate-400 text-sm mt-1">Dodaj pierwszy szablon dokumentu projektu.</p>
                      <Button size="sm" className="mt-4" onClick={openNewDoc}>
                        <Plus className="w-4 h-4 mr-1" />Dodaj szablon
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {CATEGORY_ORDER.filter(cat => byCategory[cat]?.length > 0).map(cat => {
                      const cfg = CATEGORY_CONFIG[cat]
                      const items = byCategory[cat]
                      const catExpanded = docExpanded.has(cat)
                      return (
                        <Card key={cat} className="overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                            onClick={() => setDocExpanded(prev => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next })}
                          >
                            <div className="flex items-center gap-3">
                              {catExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              <span className="text-lg">{cfg.icon}</span>
                              <span className="font-medium text-slate-800">{cfg.label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{items.length}</span>
                            </div>
                            {cfg.hasVariables && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> generowanie dla uczestnika
                              </span>
                            )}
                          </button>
                          {catExpanded && (
                            <div className="border-t divide-y">
                              {items.map(tmpl => {
                                const taskName = tasks.find(t => t.id === tmpl.task_id)?.name
                                const lineName = tasks.flatMap(t => t.budget_lines).find(l => l.id === tmpl.budget_line_id)?.name
                                let fileInfo: { file_url?: string; file_name?: string } = {}
                                try { if (tmpl.description?.startsWith("{")) fileInfo = JSON.parse(tmpl.description) } catch {}
                                return (
                                  <div key={tmpl.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm text-slate-800">{tmpl.name}</span>
                                        {tmpl.required && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">wymagany</span>}
                                        {tmpl.task_id && (
                                          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                            {lineName ?? taskName ?? "zadanie"}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        {cfg.hasVariables && tmpl.variables?.length > 0 && (
                                          <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Tag className="w-3 h-3" />
                                            zmienne: {tmpl.variables.map((v: { key: string; label: string }) => v.label).join(", ")}
                                          </span>
                                        )}
                                        {fileInfo.file_url && (
                                          <a href={fileInfo.file_url} target="_blank" rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                                            <Download className="w-3 h-3" /> {fileInfo.file_name ?? "wzór"}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {cfg.hasVariables && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                          onClick={() => openGenerateDialog(tmpl)}>
                                          <UserPlus className="w-3 h-3" />Generuj
                                        </Button>
                                      )}
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                        onClick={() => handleDeleteDoc(tmpl.id)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="font-medium mb-1 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Jak działa generowanie dokumentów?</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700 text-xs">
                    <li>Dodaj szablon (np. Deklaracja) i opcjonalnie wgraj wzór pliku PDF/DOCX</li>
                    <li>Wejdź w <strong>Uczestnicy</strong> i kliknij ikonę dokumentów przy uczestniku</li>
                    <li>Wybierz szablon → kliknij <strong>Generuj</strong> → dokument pojawi się w zestawie uczestnika</li>
                  </ol>
                </div>
              </TabsContent>

              {/* ── Protokoły ── */}
              <TabsContent value="protocols" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Szablony protokołów odbioru i innych dokumentów rozliczeniowych.</p>
                  <Button size="sm" onClick={openNewProto}>
                    <Plus className="w-4 h-4 mr-1" />Nowy szablon
                  </Button>
                </div>

                {protoTemplates.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                      <p className="text-slate-500 font-medium">Brak szablonów protokołów</p>
                      <p className="text-slate-400 text-sm mt-1">Dodaj szablon DOCX z polami <code className="bg-slate-100 px-1 rounded">{"{{zmienna}}"}</code> do automatycznego wypełniania.</p>
                      <Button size="sm" className="mt-4" onClick={openNewProto}>
                        <Plus className="w-4 h-4 mr-1" />Dodaj szablon
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {protoTemplates.map(tmpl => {
                      let fileInfo: { file_url?: string; file_name?: string } = {}
                      try { if (tmpl.description?.startsWith("{")) fileInfo = JSON.parse(tmpl.description) } catch {}
                      return (
                        <Card key={tmpl.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <FileText className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-900">{tmpl.name}</p>
                                  {tmpl.variables?.length > 0 && (
                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                      <Tag className="w-3 h-3" />
                                      zmienne: {tmpl.variables.map((v: { key: string; label: string }) => v.label).join(", ")}
                                    </p>
                                  )}
                                  {fileInfo.file_url && (
                                    <a href={fileInfo.file_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                                      <Download className="w-3 h-3" />{fileInfo.file_name ?? "wzór"}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                onClick={() => handleDeleteProto(tmpl.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">
                  <p className="font-medium mb-1 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Jak używać szablonów protokołów?</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-teal-700 text-xs">
                    <li>Przygotuj dokument DOCX z polami w formacie <code className="bg-white border rounded px-1">{"{{contractor_name}}"}</code></li>
                    <li>Wgraj wzór DOCX jako szablon poniżej</li>
                    <li>W module <strong>Rozliczenie</strong> kliknij <strong>Generuj protokół odbioru</strong> — dane zostaną automatycznie podstawione</li>
                  </ol>
                </div>
              </TabsContent>

              {/* ── Szablony umów ── */}
              <TabsContent value="contracts" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Szablony dokumentów umów (DOCX). Uzupełnij pola <code className="bg-slate-100 px-1 rounded text-xs">{`{{zmienna}}`}</code> w Wordzie — system podstawi dane wykonawcy i uczestnika.
                  </p>
                  <Button size="sm" onClick={openNewContractTmpl}>
                    <Plus className="w-4 h-4 mr-1" />Nowy szablon
                  </Button>
                </div>

                {/* Typy */}
                <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">📑 Umowa indywidualna</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">📃 Umowa grupowa</span>
                </div>

                {contractTemplates.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                      <p className="text-slate-500 font-medium">Brak szablonów umów</p>
                      <p className="text-slate-400 text-sm mt-1">
                        Dodaj szablon DOCX z polami <code className="bg-slate-100 px-1 rounded">{`{{contractor_name}}`}</code> itp.
                      </p>
                      <Button size="sm" className="mt-4" onClick={openNewContractTmpl}>
                        <Plus className="w-4 h-4 mr-1" />Dodaj szablon
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {contractTemplates.map(tmpl => {
                      const cfg = CATEGORY_CONFIG[tmpl.category as DocumentCategory]
                      let fileInfo: { file_url?: string; file_name?: string } = {}
                      try { if (tmpl.description?.startsWith("{")) fileInfo = JSON.parse(tmpl.description) } catch {}
                      return (
                        <Card key={tmpl.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="text-lg flex-shrink-0">{cfg?.icon ?? "📄"}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-900">{tmpl.name}</p>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${cfg?.color ?? ""}`}>{cfg?.label}</span>
                                  </div>
                                  {tmpl.variables?.length > 0 && (
                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                      <Tag className="w-3 h-3" />
                                      zmienne: {tmpl.variables.map((v: { key: string; label: string }) => v.label).join(", ")}
                                    </p>
                                  )}
                                  {fileInfo.file_url && (
                                    <a href={fileInfo.file_url} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                                      <Download className="w-3 h-3" />{fileInfo.file_name ?? "wzór"}
                                    </a>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                onClick={() => handleDeleteContractTmpl(tmpl.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}

                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
                  <p className="font-medium mb-1 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Jak używać szablonów umów?</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-indigo-700 text-xs">
                    <li>Przygotuj dokument DOCX z polami np. <code className="bg-white border rounded px-1">{`{{contractor_name}}`}</code>, <code className="bg-white border rounded px-1">{`{{contract_number}}`}</code></li>
                    <li>Wgraj wzór i zaznacz zmienne które szablon zawiera</li>
                    <li>Rzeczywiste umowy i wykonawcy są w sekcji <a href={`/projects/${projectId}/contacts`} className="font-semibold underline">Kontakty i umowy</a></li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>

      {/* Dialog: generuj dokument dla uczestnika */}
      <Dialog open={!!generateDialog} onOpenChange={open => { if (!open) { setGenerateDialog(null); setGeneratedSet(new Set()) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              Generuj: {generateDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Wybierz uczestnika *</Label>
              <Select value={selectedParticipantId} onValueChange={v => v && setSelectedParticipantId(v)}>
                <SelectTrigger><SelectValue placeholder="Wybierz uczestnika..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {participants.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                  ) : participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {generatedSet.has(p.id) && <Check className="w-3 h-3 text-green-600" />}
                        {p.last_name} {p.first_name}
                        {p.pesel && <span className="text-slate-400 text-xs">{p.pesel}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {generateDialog?.variables && generateDialog.variables.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                <span className="font-medium">Zmienne szablonu:</span>{" "}
                {generateDialog.variables.map((v: { key: string; label: string }) => (
                  <code key={v.key} className="bg-white border rounded px-1 py-0.5 mr-1">{`{{${v.key}}}`}</code>
                ))}
              </div>
            )}
            {generatedSet.size > 0 && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Wygenerowano dla {generatedSet.size} uczestnik{generatedSet.size === 1 ? "a" : "ów"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGenerateDialog(null); setGeneratedSet(new Set()) }}>Zamknij</Button>
            <Button onClick={handleGenerate} disabled={!selectedParticipantId || generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
              Generuj dokument
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nowy szablon protokołu */}
      <Dialog open={newProtoDialog} onOpenChange={open => { if (!open) setNewProtoDialog(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Nowy szablon protokołu</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nazwa szablonu *</Label>
              <Input
                value={protoForm.name}
                onChange={e => setProtoForm(f => ({ ...f, name: e.target.value }))}
                placeholder="np. Protokół odbioru – doradztwo zawodowe"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Tag className="w-3 h-3" /> Zmienne do generowania
              </Label>
              <p className="text-xs text-slate-400">
                Zaznacz pola które mają być wstawiane do szablonu DOCX jako <code className="bg-slate-100 px-1 rounded">{`{{klucz}}`}</code>
              </p>
              <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                {Object.entries(
                  PROTOCOL_FIELDS.reduce((acc, f) => {
                    if (!acc[f.group]) acc[f.group] = []
                    acc[f.group].push(f)
                    return acc
                  }, {} as Record<string, typeof PROTOCOL_FIELDS>)
                ).map(([group, fields]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500">{group}</div>
                    {fields.map(f => {
                      const isChecked = protoVariables.some(v => v.key === f.key)
                      return (
                        <label key={f.key} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setProtoVariables(prev => [...prev, { key: f.key, label: f.label }])
                                else setProtoVariables(prev => prev.filter(v => v.key !== f.key))
                              }}
                              className="rounded"
                            />
                            <span className="text-sm text-slate-700">{f.label}</span>
                          </div>
                          <code className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{`{{${f.key}}}`}</code>
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
              {protoVariables.length > 0 && (
                <p className="text-xs text-slate-500">
                  Wybrano: <span className="font-medium">{protoVariables.map(v => v.label).join(", ")}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Wzór pliku DOCX (opcjonalnie)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  pendingProtoFile ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-teal-400"
                }`}
                onClick={() => protoFileRef.current?.click()}
              >
                {pendingProtoFile ? (
                  <div className="text-green-700 text-sm">
                    <Upload className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="font-medium">{pendingProtoFile.name}</p>
                    <p className="text-xs text-green-600">{Math.round(pendingProtoFile.size / 1024)} KB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="text-sm text-slate-500">Wgraj wzór dokumentu (DOCX)</p>
                    <p className="text-xs text-slate-400 mt-0.5">Pola {"{{zmienna}}"} zostaną zastąpione danymi przy generowaniu</p>
                  </>
                )}
                <input
                  ref={protoFileRef}
                  type="file"
                  accept=".doc,.docx"
                  className="hidden"
                  onChange={e => { setPendingProtoFile(e.target.files?.[0] ?? null); e.target.value = "" }}
                />
              </div>
            </div>

          </div>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setNewProtoDialog(false)}>Anuluj</Button>
            <Button onClick={handleSaveProto} disabled={protoSaving || !protoForm.name.trim()}>
              {protoSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Dodaj szablon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nowy szablon umowy */}
      <Dialog open={newContractDialog} onOpenChange={open => { if (!open) setNewContractDialog(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Nowy szablon umowy</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

            {/* Typ umowy */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Typ umowy *</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["umowa_indywidualna", "umowa_grupowa"] as const).map(type => {
                  const cfg = CATEGORY_CONFIG[type]
                  return (
                    <button key={type} type="button"
                      onClick={() => {
                        setContractTmplType(type)
                        setContractTmplVariables(DEFAULT_VARIABLES[type])
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all ${
                        contractTmplType === type
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-medium shadow-sm"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-2xl">{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nazwa szablonu *</Label>
              <Input
                value={contractTmplName}
                onChange={e => setContractTmplName(e.target.value)}
                placeholder="np. Umowa zlecenia – doradztwo zawodowe"
                className="text-sm"
              />
            </div>

            {/* Zmienne – lista zależy od wybranego typu umowy */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Tag className="w-3 h-3" /> Zmienne do generowania
              </Label>
              <p className="text-xs text-slate-400">
                Zaznacz pola które mają być wstawiane do szablonu DOCX jako <code className="bg-slate-100 px-1 rounded">{`{{klucz}}`}</code>
              </p>
              <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                {Object.entries(
                  (contractTmplType === "umowa_indywidualna" ? CONTRACT_INDIVIDUAL_FIELDS : CONTRACT_GROUP_FIELDS)
                    .reduce((acc, f) => {
                      if (!acc[f.group]) acc[f.group] = []
                      acc[f.group].push(f)
                      return acc
                    }, {} as Record<string, typeof CONTRACT_INDIVIDUAL_FIELDS>)
                ).map(([group, fields]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500">{group}</div>
                    {fields.map(f => {
                      const isChecked = contractTmplVariables.some(v => v.key === f.key)
                      return (
                        <label key={f.key} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setContractTmplVariables(prev => [...prev, { key: f.key, label: f.label }])
                                else setContractTmplVariables(prev => prev.filter(v => v.key !== f.key))
                              }}
                              className="rounded"
                            />
                            <span className="text-sm text-slate-700">{f.label}</span>
                          </div>
                          <code className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{`{{${f.key}}}`}</code>
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
              {contractTmplVariables.length > 0 && (
                <p className="text-xs text-slate-500">
                  Wybrano: <span className="font-medium">{contractTmplVariables.map(v => v.label).join(", ")}</span>
                </p>
              )}
            </div>

            {/* Upload wzoru */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Wzór pliku DOCX (opcjonalnie)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  pendingContractTmplFile ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-indigo-400"
                }`}
                onClick={() => contractTmplFileRef.current?.click()}
              >
                {pendingContractTmplFile ? (
                  <div className="text-green-700 text-sm">
                    <Upload className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="font-medium">{pendingContractTmplFile.name}</p>
                    <p className="text-xs text-green-600">{Math.round(pendingContractTmplFile.size / 1024)} KB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="text-sm text-slate-500">Wgraj wzór umowy (DOCX)</p>
                    <p className="text-xs text-slate-400 mt-0.5">Pola {`{{zmienna}}`} zostaną zastąpione danymi</p>
                  </>
                )}
                <input
                  ref={contractTmplFileRef}
                  type="file"
                  accept=".doc,.docx"
                  className="hidden"
                  onChange={e => { setPendingContractTmplFile(e.target.files?.[0] ?? null); e.target.value = "" }}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setNewContractDialog(false)}>Anuluj</Button>
            <Button onClick={handleSaveContractTmpl} disabled={contractTmplSaving || !contractTmplName.trim()}>
              {contractTmplSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Dodaj szablon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: nowy szablon dokumentu */}
      <Dialog open={newDocDialog} onOpenChange={open => { if (!open) setNewDocDialog(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Nowy szablon dokumentu</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Typ dokumentu *</Label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORY_ORDER.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat]
                  return (
                    <button key={cat} type="button"
                      onClick={() => setDocForm(f => ({ ...f, category: cat }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        docForm.category === cat
                          ? "border-blue-400 bg-blue-50 text-blue-700 font-medium shadow-sm"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-lg">{cfg.icon}</span>
                      <span className="leading-tight text-center">{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nazwa szablonu *</Label>
              <Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Deklaracja uczestnictwa" className="text-sm" />
            </div>

            <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={docForm.taskScoped}
                  onChange={e => setDocForm(f => ({ ...f, taskScoped: e.target.checked, task_id: "", budget_line_id: "" }))} className="rounded" />
                <span className="font-medium text-slate-700">Przypisz do konkretnego zadania</span>
              </label>
              {docForm.taskScoped && (
                <div className="space-y-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-xs">Zadanie</Label>
                    <Select value={docForm.task_id} onValueChange={v => setDocForm(f => ({ ...f, task_id: v ?? "", budget_line_id: "" }))}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Wybierz zadanie..." /></SelectTrigger>
                      <SelectContent>{tasks.map(t => <SelectItem key={t.id} value={t.id}>Zad. {t.number}: {t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {selectedDocTask && selectedDocTask.budget_lines.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Podzadanie (opcjonalnie)</Label>
                      <Select value={docForm.budget_line_id} onValueChange={v => setDocForm(f => ({ ...f, budget_line_id: v ?? "" }))}>
                        <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Ogólnie dla zadania" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ogólnie dla zadania</SelectItem>
                          {selectedDocTask.budget_lines.map(l => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.sub_number ? `${l.sub_number} – ` : ""}{l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {CATEGORY_CONFIG[docForm.category].hasVariables && (
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Zmienne do generowania
                </Label>
                <p className="text-xs text-slate-400">
                  Zaznacz pola uczestnika które mają być wstawiane do szablonu DOCX jako <code className="bg-slate-100 px-1 rounded">{`{{klucz}}`}</code>
                </p>
                <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                  {Object.entries(
                    PARTICIPANT_FIELDS.reduce((acc, f) => {
                      if (!acc[f.group]) acc[f.group] = []
                      acc[f.group].push(f)
                      return acc
                    }, {} as Record<string, typeof PARTICIPANT_FIELDS>)
                  ).map(([group, fields]) => (
                    <div key={group}>
                      <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-500">{group}</div>
                      {fields.map(f => {
                        const isChecked = docVariables.some(v => v.key === f.key)
                        return (
                          <label key={f.key} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) setDocVariables(prev => [...prev, { key: f.key, label: f.label }])
                                  else setDocVariables(prev => prev.filter(v => v.key !== f.key))
                                }} className="rounded" />
                              <span className="text-sm text-slate-700">{f.label}</span>
                            </div>
                            <code className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{`{{${f.key}}}`}</code>
                          </label>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {docVariables.length > 0 && (
                  <p className="text-xs text-slate-500">Wybrano: <span className="font-medium">{docVariables.map(v => v.label).join(", ")}</span></p>
                )}
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={docForm.required}
                  onChange={e => setDocForm(f => ({ ...f, required: e.target.checked }))} className="rounded" />
                <span className="text-slate-700">Wymagany dla uczestnika</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Wzór pliku (opcjonalnie)</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  pendingFile ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-blue-400"
                }`}
                onClick={() => fileRef.current?.click()}
              >
                {pendingFile ? (
                  <div className="text-green-700 text-sm">
                    <Upload className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="font-medium">{pendingFile.name}</p>
                    <p className="text-xs text-green-600">{Math.round(pendingFile.size / 1024)} KB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="text-sm text-slate-500">Wgraj wzór dokumentu (PDF, DOCX)</p>
                    <p className="text-xs text-slate-400 mt-0.5">Używany do generowania i podglądu</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => { setPendingFile(e.target.files?.[0] ?? null); e.target.value = "" }} />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setNewDocDialog(false)}>Anuluj</Button>
            <Button onClick={handleSaveDoc} disabled={docSaving || !docForm.name.trim()}>
              {docSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Dodaj szablon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
