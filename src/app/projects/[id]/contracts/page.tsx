"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Loader2, FileText, ExternalLink, Pencil, X, Check } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Contractor {
  id: string
  name: string
}

interface TaskMin {
  id: string
  number: number
  name: string
}

interface BudgetLineMin {
  id: string
  task_id: string
  sub_number?: string
  name: string
}

interface Contract {
  id: string
  project_id: string
  contractor_id?: string | null
  task_id?: string | null
  budget_line_id?: string | null
  name: string
  scope?: string | null
  amount?: number | null
  date_from?: string | null
  date_to?: string | null
  status: string
  document_url?: string | null
  notes?: string | null
  created_at: string
  contractor?: Contractor | null
  task?: TaskMin | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  active: "Aktywna",
  completed: "Zakończona",
}
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
}

type FormState = {
  name: string
  contractor_id: string
  task_id: string
  budget_line_id: string
  scope: string
  amount: string
  date_from: string
  date_to: string
  status: string
  document_url: string
  notes: string
}

const emptyForm: FormState = {
  name: "", contractor_id: "", task_id: "", budget_line_id: "",
  scope: "", amount: "", date_from: "", date_to: "", status: "draft", document_url: "", notes: "",
}

function contractToForm(c: Contract): FormState {
  return {
    name: c.name,
    contractor_id: c.contractor_id ?? "",
    task_id: c.task_id ?? "",
    budget_line_id: c.budget_line_id ?? "",
    scope: c.scope ?? "",
    amount: c.amount != null ? String(c.amount) : "",
    date_from: c.date_from ?? "",
    date_to: c.date_to ?? "",
    status: c.status,
    document_url: c.document_url ?? "",
    notes: c.notes ?? "",
  }
}

function ContractForm({
  form,
  setForm,
  contractors,
  tasks,
  allBudgetLines,
  onSave,
  onCancel,
  saving,
  title,
}: {
  form: FormState
  setForm: (f: FormState | ((p: FormState) => FormState)) => void
  contractors: Contractor[]
  tasks: TaskMin[]
  allBudgetLines: BudgetLineMin[]
  onSave: () => void
  onCancel: () => void
  saving: boolean
  title: string
}) {
  const budgetLinesForTask = allBudgetLines.filter(l => l.task_id === form.task_id)
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Nazwa umowy *</Label>
            <Input placeholder="Np. Umowa na realizację IPD – Ceduro Wrocław" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Wykonawca</Label>
            <Select value={form.contractor_id} onValueChange={v => setForm(p => ({ ...p, contractor_id: v ?? "" }))}>
              <SelectTrigger><SelectValue placeholder="Wybierz..." /></SelectTrigger>
              <SelectContent>
                {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v ?? "draft" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Szkic</SelectItem>
                <SelectItem value="active">Aktywna</SelectItem>
                <SelectItem value="completed">Zakończona</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zadanie</Label>
            <Select value={form.task_id} onValueChange={v => setForm(p => ({ ...p, task_id: v ?? "", budget_line_id: "" }))}>
              <SelectTrigger><SelectValue placeholder="Wybierz zadanie..." /></SelectTrigger>
              <SelectContent>
                {tasks.map(t => <SelectItem key={t.id} value={t.id}>Zad. {t.number}: {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Podzadanie budżetowe</Label>
            <Select value={form.budget_line_id} onValueChange={v => setForm(p => ({ ...p, budget_line_id: v ?? "" }))} disabled={!form.task_id}>
              <SelectTrigger><SelectValue placeholder="Opcjonalnie..." /></SelectTrigger>
              <SelectContent>
                {budgetLinesForTask.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.sub_number && <span className="text-slate-400 font-mono text-xs mr-1">{l.sub_number}</span>}
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Zakres / przedmiot umowy</Label>
            <Textarea rows={2} placeholder="Np. Realizacja 40 sesji doradztwa zawodowego (IPD) dla uczestników projektu we Wrocławiu..." value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kwota umowy (zł)</Label>
            <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link do dokumentu / URL</Label>
            <Input placeholder="https://... lub ścieżka do pliku" value={form.document_url} onChange={e => setForm(p => ({ ...p, document_url: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data od</Label>
            <Input type="date" value={form.date_from} onChange={e => setForm(p => ({ ...p, date_from: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data do</Label>
            <Input type="date" value={form.date_to} onChange={e => setForm(p => ({ ...p, date_to: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Notatki</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Zapisz umowę
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Anuluj
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ContractsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const projectId = params.id
  const supabase = createClient()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [tasks, setTasks] = useState<TaskMin[]>([])
  const [allBudgetLines, setAllBudgetLines] = useState<BudgetLineMin[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)

  useEffect(() => { fetchData() }, [projectId])

  // Auto-open edit form when ?edit=<id> is in URL
  useEffect(() => {
    const editId = searchParams.get("edit")
    if (editId && contracts.length > 0 && editingId === null) {
      const target = contracts.find(c => c.id === editId)
      if (target) {
        setEditingId(target.id)
        setEditForm(contractToForm(target))
      }
    }
  }, [contracts, searchParams])

  async function fetchData() {
    const [contractsRes, contractorsRes, tasksRes, linesRes] = await Promise.all([
      supabase.from("contracts").select("*, contractor:contractors(id,name), task:tasks(id,number,name)").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("contractors").select("id, name").eq("project_id", projectId).order("name"),
      supabase.from("tasks").select("id, number, name").eq("project_id", projectId).order("number"),
      supabase.from("budget_lines").select("id, task_id, sub_number, name").eq("project_id", projectId),
    ])
    setContracts(contractsRes.data ?? [])
    setContractors(contractorsRes.data ?? [])
    setTasks(tasksRes.data ?? [])
    setAllBudgetLines(linesRes.data ?? [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!addForm.name.trim()) { toast.error("Podaj nazwę umowy."); return }
    setSaving(true)
    const { data, error } = await supabase.from("contracts").insert({
      project_id: projectId,
      name: addForm.name,
      contractor_id: addForm.contractor_id || null,
      task_id: addForm.task_id || null,
      budget_line_id: addForm.budget_line_id || null,
      scope: addForm.scope || null,
      amount: addForm.amount ? parseFloat(addForm.amount) : null,
      date_from: addForm.date_from || null,
      date_to: addForm.date_to || null,
      status: addForm.status,
      document_url: addForm.document_url || null,
      notes: addForm.notes || null,
    }).select("*, contractor:contractors(id,name), task:tasks(id,number,name)").single()

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContracts(prev => [data, ...prev])
    setAddForm(emptyForm)
    setShowAddForm(false)
    toast.success("Umowa dodana!")
  }

  const startEdit = (c: Contract) => {
    setEditingId(c.id)
    setEditForm(contractToForm(c))
    setShowAddForm(false)
  }

  const handleEdit = async () => {
    if (!editForm.name.trim() || !editingId) { toast.error("Podaj nazwę umowy."); return }
    setSaving(true)
    const { data, error } = await supabase.from("contracts").update({
      name: editForm.name,
      contractor_id: editForm.contractor_id || null,
      task_id: editForm.task_id || null,
      budget_line_id: editForm.budget_line_id || null,
      scope: editForm.scope || null,
      amount: editForm.amount ? parseFloat(editForm.amount) : null,
      date_from: editForm.date_from || null,
      date_to: editForm.date_to || null,
      status: editForm.status,
      document_url: editForm.document_url || null,
      notes: editForm.notes || null,
    }).eq("id", editingId).select("*, contractor:contractors(id,name), task:tasks(id,number,name)").single()

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContracts(prev => prev.map(c => c.id === editingId ? data : c))
    setEditingId(null)
    toast.success("Umowa zaktualizowana!")
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć umowę "${name}"?`)) return
    const { error } = await supabase.from("contracts").delete().eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContracts(prev => prev.filter(c => c.id !== id))
    toast.success("Usunięto.")
  }

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("contracts").update({ status }).eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Umowy z wykonawcami"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Umowy" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" />
              Wróć do projektu
            </Link>
            <div className="flex gap-2">
              <Link href={`/projects/${projectId}/contractors`}>
                <Button variant="outline" size="sm">Wykonawcy</Button>
              </Link>
              <Button size="sm" onClick={() => { setShowAddForm(true); setEditingId(null) }}>
                <Plus className="w-4 h-4 mr-1" />
                Nowa umowa
              </Button>
            </div>
          </div>

          {contractors.length === 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-800">
                Najpierw{" "}
                <Link href={`/projects/${projectId}/contractors`} className="font-semibold underline">dodaj wykonawców</Link>
                {" "}— bez nich nie można przypisać umowy.
              </CardContent>
            </Card>
          )}

          {/* Add form */}
          {showAddForm && (
            <ContractForm
              form={addForm}
              setForm={setAddForm}
              contractors={contractors}
              tasks={tasks}
              allBudgetLines={allBudgetLines}
              onSave={handleAdd}
              onCancel={() => setShowAddForm(false)}
              saving={saving}
              title="Nowa umowa"
            />
          )}

          {/* List */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
          ) : contracts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p>Brak umów. Dodaj pierwszą umowę z wykonawcą.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {contracts.map(c => (
                editingId === c.id ? (
                  <ContractForm
                    key={c.id}
                    form={editForm}
                    setForm={setEditForm}
                    contractors={contractors}
                    tasks={tasks}
                    allBudgetLines={allBudgetLines}
                    onSave={handleEdit}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                    title={`Edycja: ${c.name}`}
                  />
                ) : (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-slate-900">{c.name}</p>
                              <Select value={c.status} onValueChange={v => v && updateStatus(c.id, v)}>
                                <SelectTrigger className={`h-5 text-xs px-2 w-auto border-0 ${STATUS_COLORS[c.status] ?? ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Szkic</SelectItem>
                                  <SelectItem value="active">Aktywna</SelectItem>
                                  <SelectItem value="completed">Zakończona</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                              {c.contractor && <span className="font-medium text-slate-700">{c.contractor.name}</span>}
                              {c.task && <span>Zad. {c.task.number}: {c.task.name}</span>}
                              {c.amount && <span className="text-green-700 font-medium">{formatCurrency(c.amount)}</span>}
                              {c.date_from && <span>{formatDate(c.date_from)}{c.date_to ? ` – ${formatDate(c.date_to)}` : ""}</span>}
                            </div>
                            {c.scope && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.scope}</p>}
                            {c.document_url && (
                              <a href={c.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                                <ExternalLink className="w-3 h-3" />
                                Dokument
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100" onClick={() => startEdit(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(c.id, c.name)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
