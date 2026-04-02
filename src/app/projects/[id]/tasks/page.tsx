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
} from "lucide-react"
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
  hours_used?: number
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

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [projectRes, tasksRes, expensesRes, eventsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("tasks").select("*, budget_lines(*)").eq("project_id", projectId).order("number"),
      supabase.from("expenses").select("task_id, amount").eq("project_id", projectId).in("status", ["invoiced", "paid", "settled"]),
      supabase.from("events").select("budget_line_id, planned_hours").eq("project_id", projectId).not("budget_line_id", "is", null),
    ])

    setProject(projectRes.data)

    // Sumuj planned_hours per budget_line_id
    const hoursUsed: Record<string, number> = {}
    eventsRes.data?.forEach((ev: { budget_line_id: string | null; planned_hours: number | null }) => {
      if (ev.budget_line_id) {
        hoursUsed[ev.budget_line_id] = (hoursUsed[ev.budget_line_id] ?? 0) + (ev.planned_hours ?? 0)
      }
    })

    const tasksWithHours = (tasksRes.data ?? []).map((t) => ({
      ...t,
      budget_lines: (t.budget_lines ?? []).map((l: BudgetLine) => ({
        ...l,
        hours_used: hoursUsed[l.id] ?? 0,
      })),
    }))

    setTasks(tasksWithHours)

    const exp: Record<string, number> = {}
    expensesRes.data?.forEach((e: { task_id: string | null; amount: number }) => {
      if (e.task_id) exp[e.task_id] = (exp[e.task_id] ?? 0) + e.amount
    })
    setExpenses(exp)
    setLoading(false)
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
            <Button onClick={() => setShowNewTask(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Dodaj zadanie
            </Button>
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
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Podzadania budżetowe</h4>
                        {task.budget_lines?.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-500 border-b">
                                <th className="text-left pb-2 font-medium">Nr / Nazwa</th>
                                <th className="text-left pb-2 font-medium">Typ</th>
                                <th className="text-left pb-2 font-medium">Wykonawca</th>
                                <th className="text-right pb-2 font-medium">Pula (h)</th>
                                <th className="text-right pb-2 font-medium">Kwota</th>
                              </tr>
                            </thead>
                            <tbody>
                              {task.budget_lines.map((line) => {
                                const hoursTotal = line.total_hours ?? line.quantity_planned ?? 0
                                const hoursUsed = line.hours_used ?? 0
                                const hoursLeft = hoursTotal - hoursUsed
                                const pctUsed = hoursTotal > 0 ? Math.min(100, Math.round((hoursUsed / hoursTotal) * 100)) : 0
                                return (
                                  <tr key={line.id} className="border-b border-slate-50 hover:bg-slate-50">
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
                                    <td className="py-2 text-right">
                                      {hoursTotal > 0 ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className="text-xs font-medium">
                                            {hoursLeft}h / {hoursTotal}h
                                          </span>
                                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${pctUsed > 90 ? "bg-red-500" : pctUsed > 70 ? "bg-amber-500" : "bg-green-500"}`}
                                              style={{ width: `${pctUsed}%` }}
                                            />
                                          </div>
                                          <span className="text-xs text-slate-400">{pctUsed}% użyte</span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="py-2 text-right font-medium">{line.amount_planned ? formatCurrency(line.amount_planned) : "—"}</td>
                                  </tr>
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
    </div>
  )
}
