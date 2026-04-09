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
  FileText, Plus, Trash2, Upload, Loader2, ChevronDown, ChevronRight,
  Download, Sparkles, Tag, Link2, UserPlus, Check,
} from "lucide-react"
import type { Project, DocumentType, DocumentCategory } from "@/lib/types"

interface ParticipantMin {
  id: string
  first_name: string
  last_name: string
  pesel?: string | null
}

// Wszystkie kolumny tabeli participants jako zmienne do szablonów
const PARTICIPANT_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "first_name",        label: "Imię",                           group: "Dane osobowe" },
  { key: "last_name",         label: "Nazwisko",                       group: "Dane osobowe" },
  { key: "pesel",             label: "PESEL",                          group: "Dane osobowe" },
  { key: "gender",            label: "Płeć",                           group: "Dane osobowe" },
  { key: "age_at_start",      label: "Wiek (w chwili przystąpienia)",  group: "Dane osobowe" },
  { key: "nationality",       label: "Obywatelstwo",                   group: "Dane osobowe" },
  { key: "email",             label: "Email",                          group: "Kontakt" },
  { key: "phone",             label: "Telefon",                        group: "Kontakt" },
  { key: "city",              label: "Miejscowość",                    group: "Adres" },
  { key: "county",            label: "Powiat",                         group: "Adres" },
  { key: "commune",           label: "Gmina",                          group: "Adres" },
  { key: "voivodeship",       label: "Województwo",                    group: "Adres" },
  { key: "postal_code",       label: "Kod pocztowy",                   group: "Adres" },
  { key: "education_level",   label: "Wykształcenie",                  group: "Projekt" },
  { key: "employment_status", label: "Status na rynku pracy",          group: "Projekt" },
  { key: "support_start_date",label: "Data rozpoczęcia wsparcia",      group: "Projekt" },
  { key: "project_start_date",label: "Data przystąpienia do projektu", group: "Projekt" },
]

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; color: string; icon: string; hasVariables: boolean }> = {
  deklaracja:          { label: "Deklaracja",              color: "bg-blue-100 text-blue-700",    icon: "📋", hasVariables: true },
  formularz_online:    { label: "Formularz online",        color: "bg-violet-100 text-violet-700", icon: "🌐", hasVariables: true },
  formularz_papierowy: { label: "Formularz papierowy",     color: "bg-slate-100 text-slate-700",  icon: "📄", hasVariables: false },
  rodo:                { label: "Zgody RODO",              color: "bg-orange-100 text-orange-700", icon: "🔒", hasVariables: false },
  pretest:             { label: "Pretest",                 color: "bg-amber-100 text-amber-700",  icon: "📝", hasVariables: false },
  posttest:            { label: "Posttest",                color: "bg-green-100 text-green-700",  icon: "✅", hasVariables: false },
  certyfikat:          { label: "Certyfikat",              color: "bg-yellow-100 text-yellow-700", icon: "🏆", hasVariables: true },
  inne:                { label: "Inne",                    color: "bg-gray-100 text-gray-600",    icon: "📁", hasVariables: false },
  protokol:            { label: "Protokół",                color: "bg-teal-100 text-teal-700",    icon: "📝", hasVariables: true },
  umowa_indywidualna:  { label: "Umowa indywidualna",     color: "bg-indigo-100 text-indigo-700", icon: "📑", hasVariables: true },
  umowa_grupowa:       { label: "Umowa grupowa",           color: "bg-purple-100 text-purple-700", icon: "📃", hasVariables: true },
}

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
  protokol:            [],
  umowa_indywidualna:  [],
  umowa_grupowa:       [],
}

interface TaskOption {
  id: string
  number: number
  name: string
  budget_lines: { id: string; sub_number?: string | null; name: string }[]
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [templates, setTemplates] = useState<DocumentType[]>([])
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Generuj dla uczestnika – dialog
  const [generateDialog, setGenerateDialog] = useState<DocumentType | null>(null)
  const [participants, setParticipants] = useState<ParticipantMin[]>([])
  const [selectedParticipantId, setSelectedParticipantId] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatedSet, setGeneratedSet] = useState<Set<string>>(new Set()) // participantId po wygenerowaniu

  // Nowy szablon – dialog
  const [newDialog, setNewDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category: "deklaracja" as DocumentCategory,
    name: "",
    required: false,
    taskScoped: false,
    task_id: "",
    budget_line_id: "",
    notes: "",
  })
  const [variables, setVariables] = useState<{ key: string; label: string }[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchAll() }, [projectId])

  // Auto-ustaw zmienne gdy zmienia się kategoria
  useEffect(() => {
    const cfg = CATEGORY_CONFIG[form.category]
    if (cfg.hasVariables) {
      setVariables(DEFAULT_VARIABLES[form.category] ?? [])
    } else {
      setVariables([])
    }
  }, [form.category])

  // Auto-ustaw nazwę z kategorii jeśli pusta
  useEffect(() => {
    if (!form.name) {
      setForm(f => ({ ...f, name: CATEGORY_CONFIG[form.category].label }))
    }
  }, [form.category])

  async function openGenerateDialog(tmpl: DocumentType) {
    setGenerateDialog(tmpl)
    setSelectedParticipantId("")
    setGeneratedSet(new Set())
    if (participants.length === 0) {
      const { data } = await supabase
        .from("participants")
        .select("id, first_name, last_name, pesel")
        .eq("project_id", projectId)
        .order("last_name")
      setParticipants((data ?? []) as ParticipantMin[])
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
        body: JSON.stringify({
          document_type_id: generateDialog.id,
          participant_id: selectedParticipantId,
          project_id: projectId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error("Błąd generowania: " + (json.error ?? res.statusText))
        return
      }
      setGeneratedSet(prev => new Set([...prev, selectedParticipantId]))
      toast.success(`Wygenerowano dla ${p?.first_name} ${p?.last_name}!`)
      setSelectedParticipantId("")
    } finally {
      setGenerating(false)
    }
  }

  async function fetchAll() {
    setLoading(true)
    const [projectRes, templatesRes, tasksRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("document_types").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("tasks").select("id, number, name, budget_lines(id, sub_number, name)").eq("project_id", projectId).order("number"),
    ])
    setProject(projectRes.data)
    setTemplates((templatesRes.data ?? []) as DocumentType[])
    setTasks((tasksRes.data ?? []) as unknown as TaskOption[])
    setLoading(false)
  }

  function openNew() {
    setForm({ category: "deklaracja", name: CATEGORY_CONFIG.deklaracja.label, required: false, taskScoped: false, task_id: "", budget_line_id: "", notes: "" })
    setVariables(DEFAULT_VARIABLES.deklaracja)
    setPendingFile(null)
    setNewDialog(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Podaj nazwę szablonu"); return }
    setSaving(true)

    let file_url: string | null = null
    let file_name: string | null = null

    if (pendingFile) {
      const storagePath = `${projectId}/templates/${Date.now()}_${pendingFile.name}`
      const { error: upErr } = await supabase.storage
        .from("participant-documents")
        .upload(storagePath, pendingFile, { upsert: false })
      if (upErr) { toast.error("Błąd uploadu: " + upErr.message); setSaving(false); return }
      const { data: urlData } = supabase.storage.from("participant-documents").getPublicUrl(storagePath)
      file_url = urlData.publicUrl
      file_name = pendingFile.name
    }

    const { data, error } = await supabase
      .from("document_types")
      .insert({
        project_id: projectId,
        name: form.name.trim(),
        category: form.category,
        required: form.required,
        task_id: form.taskScoped && form.task_id ? form.task_id : null,
        budget_line_id: form.taskScoped && form.budget_line_id ? form.budget_line_id : null,
        variables: CATEGORY_CONFIG[form.category].hasVariables ? variables : [],
        description: form.notes.trim() || null,
        sort_order: templates.length,
        // Przechowaj plik szablonu w description jako JSON jeśli plik
        ...(file_url ? { description: JSON.stringify({ notes: form.notes, file_url, file_name }) } : {}),
      })
      .select()
      .single()

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setTemplates(prev => [...prev, data as DocumentType])
    setNewDialog(false)
    toast.success("Szablon dodany!")
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć ten szablon dokumentu?")) return
    const { error } = await supabase.from("document_types").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success("Usunięto.")
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedTask = tasks.find(t => t.id === form.task_id)

  // Grupuj szablony po kategorii
  const byCategory = templates.reduce((acc, t) => {
    const cat = (t.category as DocumentCategory) ?? "inne"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<DocumentCategory, DocumentType[]>)

  const categoryOrder: DocumentCategory[] = ["deklaracja", "formularz_online", "formularz_papierowy", "rodo", "pretest", "posttest", "certyfikat", "inne"]

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Szablony dokumentów"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Dokumenty" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Szablony dokumentów projektu. Z każdego szablonu możesz generować dokumenty dla uczestników.
              </p>
            </div>
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />
              Nowy szablon
            </Button>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-2">
            {categoryOrder.map(cat => {
              const cfg = CATEGORY_CONFIG[cat]
              return (
                <span key={cat} className={`text-xs px-2 py-1 rounded-full ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              )
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium">Brak szablonów</p>
                <p className="text-slate-400 text-sm mt-1">Dodaj pierwszy szablon dokumentu projektu.</p>
                <Button size="sm" className="mt-4" onClick={openNew}>
                  <Plus className="w-4 h-4 mr-1" />Dodaj szablon
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {categoryOrder.filter(cat => byCategory[cat]?.length > 0).map(cat => {
                const cfg = CATEGORY_CONFIG[cat]
                const items = byCategory[cat]
                const catExpanded = expanded.has(cat)
                return (
                  <Card key={cat} className="overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => toggleExpand(cat)}
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
                          const lineName = tasks
                            .flatMap(t => t.budget_lines)
                            .find(l => l.id === tmpl.budget_line_id)?.name
                          let fileInfo: { file_url?: string; file_name?: string } = {}
                          try {
                            if (tmpl.description?.startsWith("{")) fileInfo = JSON.parse(tmpl.description)
                          } catch {}
                          return (
                            <div key={tmpl.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm text-slate-800">{tmpl.name}</span>
                                  {tmpl.required && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">wymagany</span>
                                  )}
                                  {tmpl.task_id && (
                                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                      <Link2 className="w-3 h-3" />
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
                                    <UserPlus className="w-3 h-3" />
                                    Generuj
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                  onClick={() => handleDelete(tmpl.id)}>
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

          {/* Info box */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium mb-1 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Jak działa generowanie dokumentów?</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700 text-xs">
              <li>Dodaj szablon (np. Deklaracja) i opcjonalnie wgraj wzór pliku PDF/DOCX</li>
              <li>Wejdź w <strong>Uczestnicy</strong> i kliknij ikonę dokumentów przy uczestniku</li>
              <li>Wybierz szablon → kliknij <strong>Generuj</strong> → dokument pojawi się w zestawie uczestnika</li>
              <li>Pobierz wygenerowany dokument lub wyślij go przez webhook</li>
            </ol>
          </div>
        </main>
      </div>

      {/* Dialog: generuj dla uczestnika */}
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
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz uczestnika..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {participants.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                  ) : (
                    participants.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          {generatedSet.has(p.id) && <Check className="w-3 h-3 text-green-600" />}
                          {p.last_name} {p.first_name}
                          {p.pesel && <span className="text-slate-400 text-xs">{p.pesel}</span>}
                        </span>
                      </SelectItem>
                    ))
                  )}
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

      {/* Dialog nowego szablonu */}
      <Dialog open={newDialog} onOpenChange={open => { if (!open) setNewDialog(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nowy szablon dokumentu</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

            {/* Kategoria */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Typ dokumentu *</Label>
              <div className="grid grid-cols-4 gap-2">
                {categoryOrder.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                        form.category === cat
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

            {/* Nazwa */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nazwa szablonu *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="np. Deklaracja uczestnictwa"
                className="text-sm"
              />
            </div>

            {/* Przypisanie do zadania */}
            <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.taskScoped}
                  onChange={e => setForm(f => ({ ...f, taskScoped: e.target.checked, task_id: "", budget_line_id: "" }))}
                  className="rounded"
                />
                <span className="font-medium text-slate-700">Przypisz do konkretnego zadania</span>
              </label>
              {form.taskScoped && (
                <div className="space-y-2 pl-6">
                  <div className="space-y-1">
                    <Label className="text-xs">Zadanie</Label>
                    <Select value={form.task_id} onValueChange={v => setForm(f => ({ ...f, task_id: v ?? "", budget_line_id: "" }))}>
                      <SelectTrigger className="text-sm h-9">
                        <SelectValue placeholder="Wybierz zadanie..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks.map(t => (
                          <SelectItem key={t.id} value={t.id}>Zad. {t.number}: {t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTask && selectedTask.budget_lines.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Podzadanie (opcjonalnie)</Label>
                      <Select value={form.budget_line_id} onValueChange={v => setForm(f => ({ ...f, budget_line_id: v ?? "" }))}>
                        <SelectTrigger className="text-sm h-9">
                          <SelectValue placeholder="Ogólnie dla zadania" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ogólnie dla zadania</SelectItem>
                          {selectedTask.budget_lines.map(l => (
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

            {/* Zmienne (tylko dla kategorii z hasVariables) */}
            {CATEGORY_CONFIG[form.category].hasVariables && (
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
                        const isChecked = variables.some(v => v.key === f.key)
                        return (
                          <label key={f.key} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setVariables(prev => [...prev, { key: f.key, label: f.label }])
                                  } else {
                                    setVariables(prev => prev.filter(v => v.key !== f.key))
                                  }
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
                {variables.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Wybrano: <span className="font-medium">{variables.map(v => v.label).join(", ")}</span>
                  </p>
                )}
              </div>
            )}

            {/* Opcje */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-slate-700">Wymagany dla uczestnika</span>
              </label>
            </div>

            {/* Upload wzoru pliku */}
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
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={e => { setPendingFile(e.target.files?.[0] ?? null); e.target.value = "" }}
                />
              </div>
            </div>

          </div>
          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setNewDialog(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Dodaj szablon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
