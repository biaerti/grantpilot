"use client"

import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BudgetProgress } from "@/components/budget/budget-progress"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Loader2,
  ArrowLeft,
  FileText,
  Download,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import type { Project } from "@/lib/types"

interface BudgetLine {
  id: string
  task_id: string
  project_id: string
  name: string
  unit?: string
  unit_cost?: number
  quantity_planned?: number
  amount_planned?: number
  category: string
  notes?: string
  sub_number?: string
  line_type?: string
  contractor_name?: string
  total_hours?: number
  cost_used?: number
}

interface TaskLocal {
  id: string
  project_id: string
  number: number
  name: string
  description?: string
  budget_direct: number
  budget_indirect: number
  budget_total?: number
  created_at: string
  budget_lines: BudgetLine[]
}

export default function TasksPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<TaskLocal[]>([])
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ number: "", name: "", description: "", budget_direct: "", budget_indirect: "" })
  const [savingTask, setSavingTask] = useState(false)
  const [expenses, setExpenses] = useState<Record<string, number>>({})
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set())
  const [contracts, setContracts] = useState<{ id: string; name: string; status: string; amount?: number | null; date_from?: string | null; date_to?: string | null; task_id?: string | null; budget_line_id?: string | null; contractor?: { name: string } | null }[]>([])
  const [docsDialog, setDocsDialog] = useState<{ taskId: string; lineId?: string; lineName: string } | null>(null)
  const [taskDocs, setTaskDocs] = useState<{ id: string; name: string; file_url?: string | null; file_name?: string | null; mime_type?: string | null; uploaded_at: string; participant?: { first_name: string; last_name: string } | null; document_type?: { name: string } | null }[]>([])
  const [taskDocsLoading, setTaskDocsLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [projectRes, tasksRes, expensesRes, eventsRes, contractsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("tasks").select("*, budget_lines(*)").eq("project_id", projectId).order("number"),
      supabase.from("expenses").select("task_id, budget_line_id, amount").eq("project_id", projectId).in("status", ["invoiced", "paid", "settled"]),
      supabase.from("events").select("budget_line_id, planned_cost").eq("project_id", projectId).not("budget_line_id", "is", null),
      supabase.from("contracts").select("id, name, status, amount, date_from, date_to, task_id, budget_line_id, contractor:contractors(name)").eq("project_id", projectId),
    ])

    setProject(projectRes.data)
    setContracts((contractsRes.data ?? []) as unknown as typeof contracts)

    // Sumuj planned_cost z eventów per budget_line_id
    const costFromEvents: Record<string, number> = {}
    eventsRes.data?.forEach((ev: { budget_line_id: string | null; planned_cost: number | null }) => {
      if (ev.budget_line_id) {
        costFromEvents[ev.budget_line_id] = (costFromEvents[ev.budget_line_id] ?? 0) + (ev.planned_cost ?? 0)
      }
    })

    // Sumuj wydatki per task_id i per budget_line_id
    const exp: Record<string, number> = {}
    const costFromExpensesByLine: Record<string, number> = {}
    expensesRes.data?.forEach((e: { task_id: string | null; budget_line_id: string | null; amount: number }) => {
      if (e.task_id) exp[e.task_id] = (exp[e.task_id] ?? 0) + e.amount
      if (e.budget_line_id) {
        costFromExpensesByLine[e.budget_line_id] = (costFromExpensesByLine[e.budget_line_id] ?? 0) + e.amount
      }
    })

    // Dla każdego zadania: rozdziel wydatki task-level proporcjonalnie na podzadania
    const tasksData = (tasksRes.data ?? []).map((t) => {
      const lines: BudgetLine[] = t.budget_lines ?? []
      const taskSpent = exp[t.id] ?? 0
      const totalLinesBudget = lines.reduce((s: number, l: BudgetLine) => s + (l.amount_planned ?? 0), 0)

      return {
        ...t,
        budget_lines: lines.map((l: BudgetLine) => {
          const fromEvents = costFromEvents[l.id] ?? 0
          const fromExpensesDirect = costFromExpensesByLine[l.id] ?? 0
          // Wydatki task-level rozłożone proporcjonalnie (tylko jeśli nie ma bezpośrednich)
          const proportion = totalLinesBudget > 0 ? (l.amount_planned ?? 0) / totalLinesBudget : 0
          const fromTaskProportional = fromExpensesDirect === 0 ? taskSpent * proportion : 0
          return {
            ...l,
            cost_used: fromEvents + fromExpensesDirect + fromTaskProportional,
          }
        }),
      }
    })

    setTasks(tasksData)
    setExpenses(exp)
    setLoading(false)
  }

  function isContractActive(c: { status: string; date_from?: string | null; date_to?: string | null }) {
    if (c.status !== "active") return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (c.date_from && new Date(c.date_from) > today) return false
    if (c.date_to && new Date(c.date_to) < today) return false
    return true
  }

  function contractDisplayStatus(c: { status: string; date_from?: string | null; date_to?: string | null }) {
    if (c.status === "active") {
      if (!isContractActive(c)) return "expired"
      return "active"
    }
    if (c.status === "completed") return "completed"
    return "draft"
  }

  async function openDocsDialog(taskId: string, lineId?: string, lineName?: string) {
    setDocsDialog({ taskId, lineId, lineName: lineName ?? "zadanie" })
    setTaskDocsLoading(true)
    let query = supabase
      .from("participant_documents")
      .select("id, name, file_url, file_name, mime_type, uploaded_at, participant:participants(first_name, last_name), document_type:document_types!document_type_id(name)")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false })
    const { data } = await query
    setTaskDocs((data ?? []) as unknown as typeof taskDocs)
    setTaskDocsLoading(false)
  }

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleAddTask = async () => {
    if (!newTask.name || !newTask.number) {
      toast.error("Podaj numer i nazwę zadania.")
      return
    }
    setSavingTask(true)

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        number: parseInt(newTask.number),
        name: newTask.name,
        description: newTask.description || null,
        budget_direct: parseFloat(newTask.budget_direct) || 0,
        budget_indirect: parseFloat(newTask.budget_indirect) || 0,
      })
      .select("*, budget_lines(*)")
      .single()

    setSavingTask(false)
    if (error) {
      toast.error("Błąd: " + error.message)
      return
    }

    setTasks((prev) => [...prev, data].sort((a, b) => a.number - b.number))
    setNewTask({ number: "", name: "", description: "", budget_direct: "", budget_indirect: "" })
    setShowNewTask(false)
    toast.success("Zadanie dodane!")
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Usunąć zadanie i wszystkie powiązane pozycje budżetowe?")) return
    const { error } = await supabase.from("tasks").delete().eq("id", taskId)
    if (error) { toast.error("Błąd: " + error.message); return }
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    toast.success("Zadanie usunięte.")
  }

  const totalBudget = tasks.reduce((s, t) => s + (t.budget_total ?? t.budget_direct), 0)
  const totalSpent = tasks.reduce((s, t) => s + (expenses[t.id] ?? 0), 0)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Zadania i budżet"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Zadania" },
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
              <Link href={`/projects/${projectId}/contracts`}>
                <Button variant="outline" size="sm">Umowy</Button>
              </Link>
              <Link href={`/projects/${projectId}/settlement`}>
                <Button variant="outline" size="sm">Rozliczenie</Button>
              </Link>
              <Button onClick={() => setShowNewTask(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Dodaj zadanie
              </Button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-500">Budżet bezpośredni</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totalBudget)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-500">Koszty pośrednie (20%)</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totalBudget * (project?.indirect_cost_rate ?? 0.2))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-slate-500">Wydano łącznie</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
              </CardContent>
            </Card>
          </div>

          {/* New task form */}
          {showNewTask && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nowe zadanie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nr zadania *</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={newTask.number}
                      onChange={(e) => setNewTask((p) => ({ ...p, number: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Nazwa *</Label>
                    <Input
                      placeholder="Kampania informacyjna"
                      value={newTask.name}
                      onChange={(e) => setNewTask((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Budżet bezpośredni (zł)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newTask.budget_direct}
                      onChange={(e) => setNewTask((p) => ({ ...p, budget_direct: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Budżet pośredni (zł)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newTask.budget_indirect}
                      onChange={(e) => setNewTask((p) => ({ ...p, budget_indirect: e.target.value }))}
                    />
                  </div>
                </div>
                <Textarea
                  placeholder="Opis zadania..."
                  value={newTask.description}
                  onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddTask} size="sm" disabled={savingTask}>
                    {savingTask ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Zapisz
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowNewTask(false)}>Anuluj</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task list */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <p>Brak zadań. Dodaj pierwsze zadanie projektu.</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => {
              const spent = expenses[task.id] ?? 0
              const isExpanded = expandedTasks.has(task.id)

              return (
                <Card key={task.id}>
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 rounded-t-lg"
                    onClick={() => toggleTask(task.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Zadanie {task.number}: {task.name}
                        </h3>
                        {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-slate-700">{formatCurrency(task.budget_total ?? task.budget_direct)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id) }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0 border-t border-slate-100">
                      <div className="py-3">
                        <BudgetProgress
                          label="Postęp wydatków"
                          planned={task.budget_total ?? task.budget_direct}
                          spent={spent}
                          showIndirect
                          indirectRate={project?.indirect_cost_rate ?? 0.2}
                        />
                      </div>

                      {/* Budget lines / Podzadania */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-700">Podzadania budżetowe</h4>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                              onClick={() => openDocsDialog(task.id, undefined, task.name)}>
                              <FileText className="w-3 h-3" />
                              Dokumenty
                            </Button>
                            <Link href={`/projects/${projectId}/events/new?task_id=${task.id}`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                <Plus className="w-3 h-3" />
                                Dodaj zdarzenie
                              </Button>
                            </Link>
                          </div>
                        </div>
                        {task.budget_lines?.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-500 border-b">
                                <th className="text-left pb-2 font-medium">Nr / Nazwa</th>
                                <th className="text-left pb-2 font-medium">Typ</th>
                                <th className="text-left pb-2 font-medium">Realizator</th>
                                <th className="text-left pb-2 font-medium">Umowa</th>
                                <th className="text-right pb-2 font-medium">Wydano / Budżet</th>
                                <th className="pb-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {task.budget_lines.map((line) => {
                                const budget = line.amount_planned ?? 0
                                const used = line.cost_used ?? 0
                                const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0
                                // Umowy powiązane z tym podzadaniem lub z zadaniem ogólnie
                                const lineContracts = contracts.filter(c =>
                                  c.budget_line_id === line.id || (!c.budget_line_id && c.task_id === task.id)
                                )
                                const hasActive = lineContracts.some(c => isContractActive(c))
                                const contractKey = `${line.id}`
                                const contractsExpanded = expandedContracts.has(contractKey)
                                return (
                                  <React.Fragment key={line.id}>
                                  <tr className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="py-2">
                                      {line.sub_number && (
                                        <span className="text-xs font-mono text-slate-400 mr-1">{line.sub_number}</span>
                                      )}
                                      <span>{line.name}</span>
                                    </td>
                                    <td className="py-2">
                                      {line.line_type === "W" ? (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Wynagrodzenie</span>
                                      ) : line.line_type === "S" ? (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Sala</span>
                                      ) : (
                                        <span className="text-xs text-slate-400">{line.category}</span>
                                      )}
                                    </td>
                                    <td className="py-2 text-slate-500 text-xs">{line.contractor_name ?? "—"}</td>
                                    <td className="py-2">
                                      {lineContracts.length === 0 ? (
                                        <a href={`/projects/${projectId}/contracts`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-600">+ umowa</a>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedContracts(prev => {
                                              const next = new Set(prev)
                                              next.has(contractKey) ? next.delete(contractKey) : next.add(contractKey)
                                              return next
                                            })}
                                            className="flex items-center gap-1 text-xs"
                                          >
                                            {hasActive ? (
                                              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Aktywna ✓</span>
                                            ) : (
                                              <a href={`/projects/${projectId}/contracts`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200">⚠ Brak aktywnej +</a>
                                            )}
                                            <span className="text-slate-400">{contractsExpanded ? "▲" : "▼"}</span>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 text-right">
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className="text-xs font-medium text-slate-700">
                                          {used > 0 ? formatCurrency(used) : <span className="text-slate-400">0 zł</span>}
                                          {" "}<span className="text-slate-400 font-normal">/ {budget > 0 ? formatCurrency(budget) : "—"}</span>
                                        </span>
                                        {budget > 0 && (
                                          <>
                                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : pct > 0 ? "bg-blue-500" : "bg-slate-300"}`}
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <span className="text-xs text-slate-400">{pct}%</span>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 text-right">
                                      <Link href={`/projects/${projectId}/events/new?task_id=${task.id}&budget_line_id=${line.id}`}>
                                        <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-800 px-2">
                                          + zdarzenie
                                        </Button>
                                      </Link>
                                    </td>
                                  </tr>
                                  {contractsExpanded && lineContracts.map(c => (
                                    <tr key={c.id} className="bg-slate-50 border-b border-slate-100">
                                      <td colSpan={3} className="py-1.5 pl-8 text-xs text-slate-600">
                                        {(() => {
                                          const ds = contractDisplayStatus(c)
                                          return (
                                            <span className={`mr-2 px-1.5 py-0.5 rounded text-xs ${ds === "active" ? "bg-green-100 text-green-700" : ds === "expired" ? "bg-slate-100 text-slate-500" : ds === "completed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                                              {ds === "active" ? "Aktywna" : ds === "expired" ? "Nieaktualna" : ds === "completed" ? "Zakończona" : "Szkic"}
                                            </span>
                                          )
                                        })()}
                                        <strong>{c.name}</strong>
                                        {c.contractor && <span className="text-slate-400 ml-1">· {c.contractor.name}</span>}
                                        {c.date_from && <span className="text-slate-400 ml-1">· {c.date_from.slice(0,10)}{c.date_to ? ` – ${c.date_to.slice(0,10)}` : ""}</span>}
                                      </td>
                                      <td className="py-1.5 text-xs text-slate-500">{c.amount ? formatCurrency(c.amount) : "—"}</td>
                                      <td colSpan={2} className="py-1.5 text-right pr-2">
                                        <Link href={`/projects/${projectId}/contracts?edit=${c.id}`} className="text-xs text-blue-600 hover:underline">edytuj</Link>
                                      </td>
                                    </tr>
                                  ))}
                                  </React.Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Brak podzadań – uruchom skrypt seed-pns.mjs po migracji.</p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })
          )}
        </main>
      </div>
      {/* Dokumenty zadania */}
      <Dialog open={!!docsDialog} onOpenChange={open => { if (!open) setDocsDialog(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Dokumenty – {docsDialog?.lineName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 py-2">
            {taskDocsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              </div>
            ) : taskDocs.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                <p className="text-sm">Brak dokumentów w tym projekcie</p>
                <a href={`/projects/${projectId}/documents`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  Przejdź do zarządzania dokumentami →
                </a>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 px-1 pb-1">
                  Wszystkie dokumenty projektu ({taskDocs.length}).{" "}
                  <a href={`/projects/${projectId}/documents`} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline">
                    Dodaj nowe →
                  </a>
                </p>
                {taskDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100">
                    <span className="text-lg flex-shrink-0">
                      {doc.mime_type?.includes("pdf") ? "📕" : doc.mime_type?.includes("word") || doc.mime_type?.includes("docx") ? "📘" : doc.mime_type?.includes("image") ? "🖼️" : "📄"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {doc.participant && (
                          <span className="text-slate-600">{doc.participant.last_name} {doc.participant.first_name}</span>
                        )}
                        {doc.document_type && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{doc.document_type.name}</span>
                        )}
                        <span>{new Date(doc.uploaded_at).toLocaleDateString("pl-PL")}</span>
                      </div>
                    </div>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-slate-400 hover:text-blue-600 p-1">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
