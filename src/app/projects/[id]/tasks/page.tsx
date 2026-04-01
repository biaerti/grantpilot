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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import type { Task, BudgetLine, Project } from "@/lib/types"

export default function TasksPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<(Task & { budget_lines: BudgetLine[] })[]>([])
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ number: "", name: "", description: "", budget_direct: "", budget_indirect: "" })
  const [savingTask, setSavingTask] = useState(false)
  const [newBudgetLines, setNewBudgetLines] = useState<Record<string, { name: string; unit: string; unit_cost: string; quantity_planned: string; category: string }>>({})
  const [addingLine, setAddingLine] = useState<Record<string, boolean>>({})

  const [expenses, setExpenses] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [projectRes, tasksRes, expensesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("tasks").select("*, budget_lines(*)").eq("project_id", projectId).order("number"),
      supabase.from("expenses").select("task_id, amount").eq("project_id", projectId).in("status", ["invoiced", "paid", "settled"]),
    ])

    setProject(projectRes.data)
    setTasks(tasksRes.data ?? [])

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

  const handleAddBudgetLine = async (taskId: string) => {
    const line = newBudgetLines[taskId]
    if (!line?.name) { toast.error("Podaj nazwę pozycji."); return }
    setAddingLine((prev) => ({ ...prev, [taskId]: true }))

    const unitCost = parseFloat(line.unit_cost) || 0
    const qty = parseFloat(line.quantity_planned) || 0
    const amount = unitCost * qty || 0

    const { data, error } = await supabase
      .from("budget_lines")
      .insert({
        task_id: taskId,
        project_id: projectId,
        name: line.name,
        unit: line.unit || null,
        unit_cost: unitCost || null,
        quantity_planned: qty || null,
        amount_planned: amount || null,
        category: line.category || "other",
      })
      .select()
      .single()

    setAddingLine((prev) => ({ ...prev, [taskId]: false }))
    if (error) { toast.error("Błąd: " + error.message); return }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, budget_lines: [...(t.budget_lines ?? []), data] }
          : t
      )
    )
    setNewBudgetLines((prev) => ({ ...prev, [taskId]: { name: "", unit: "", unit_cost: "", quantity_planned: "", category: "other" } }))
    toast.success("Pozycja dodana!")
  }

  const handleDeleteBudgetLine = async (taskId: string, lineId: string) => {
    const { error } = await supabase.from("budget_lines").delete().eq("id", lineId)
    if (error) { toast.error("Błąd: " + error.message); return }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, budget_lines: t.budget_lines.filter((l) => l.id !== lineId) }
          : t
      )
    )
    toast.success("Pozycja usunięta.")
  }

  const categoryLabels: Record<string, string> = {
    personnel: "Personel",
    subcontracting: "Podwykonawstwo",
    other: "Inne",
    indirect: "Pośrednie",
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
              const currentNewLine = newBudgetLines[task.id] ?? { name: "", unit: "", unit_cost: "", quantity_planned: "", category: "other" }

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

                      {/* Budget lines */}
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Pozycje budżetowe</h4>
                        {task.budget_lines?.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-500 border-b">
                                <th className="text-left pb-2 font-medium">Nazwa</th>
                                <th className="text-left pb-2 font-medium">Kategoria</th>
                                <th className="text-right pb-2 font-medium">Jedn.</th>
                                <th className="text-right pb-2 font-medium">Stawka</th>
                                <th className="text-right pb-2 font-medium">Ilość</th>
                                <th className="text-right pb-2 font-medium">Kwota</th>
                                <th className="pb-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {task.budget_lines.map((line) => (
                                <tr key={line.id} className="border-b border-slate-50 hover:bg-slate-50">
                                  <td className="py-1.5">{line.name}</td>
                                  <td className="py-1.5 text-slate-500">{categoryLabels[line.category] ?? line.category}</td>
                                  <td className="py-1.5 text-right text-slate-500">{line.unit ?? "—"}</td>
                                  <td className="py-1.5 text-right text-slate-500">{line.unit_cost ? formatCurrency(line.unit_cost) : "—"}</td>
                                  <td className="py-1.5 text-right text-slate-500">{line.quantity_planned ?? "—"}</td>
                                  <td className="py-1.5 text-right font-medium">{formatCurrency(line.amount_planned)}</td>
                                  <td className="py-1.5 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                      onClick={() => handleDeleteBudgetLine(task.id, line.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-sm text-slate-400 italic mb-2">Brak pozycji budżetowych.</p>
                        )}

                        {/* Add budget line form */}
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-2">
                          <p className="text-xs font-medium text-slate-600">Dodaj pozycję budżetową</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              className="h-8 text-sm"
                              placeholder="Nazwa pozycji *"
                              value={currentNewLine.name}
                              onChange={(e) => setNewBudgetLines((p) => ({ ...p, [task.id]: { ...currentNewLine, name: e.target.value } }))}
                            />
                            <Select
                              value={currentNewLine.category}
                              onValueChange={(v) => setNewBudgetLines((p) => ({ ...p, [task.id]: { ...currentNewLine, category: v ?? "other" } }))}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="personnel">Personel</SelectItem>
                                <SelectItem value="subcontracting">Podwykonawstwo</SelectItem>
                                <SelectItem value="other">Inne</SelectItem>
                                <SelectItem value="indirect">Pośrednie</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              className="h-8 text-sm"
                              placeholder="Jednostka (h, szt)"
                              value={currentNewLine.unit}
                              onChange={(e) => setNewBudgetLines((p) => ({ ...p, [task.id]: { ...currentNewLine, unit: e.target.value } }))}
                            />
                            <Input
                              className="h-8 text-sm"
                              type="number"
                              placeholder="Stawka (zł)"
                              value={currentNewLine.unit_cost}
                              onChange={(e) => setNewBudgetLines((p) => ({ ...p, [task.id]: { ...currentNewLine, unit_cost: e.target.value } }))}
                            />
                            <Input
                              className="h-8 text-sm"
                              type="number"
                              placeholder="Ilość"
                              value={currentNewLine.quantity_planned}
                              onChange={(e) => setNewBudgetLines((p) => ({ ...p, [task.id]: { ...currentNewLine, quantity_planned: e.target.value } }))}
                            />
                          </div>
                          {currentNewLine.unit_cost && currentNewLine.quantity_planned && (
                            <p className="text-xs text-slate-500">
                              Kwota: {formatCurrency(parseFloat(currentNewLine.unit_cost) * parseFloat(currentNewLine.quantity_planned))}
                            </p>
                          )}
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleAddBudgetLine(task.id)}
                            disabled={addingLine[task.id]}
                          >
                            {addingLine[task.id] ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                            Dodaj pozycję
                          </Button>
                        </div>
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
