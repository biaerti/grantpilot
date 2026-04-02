"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
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
import { ArrowLeft, Loader2, X } from "lucide-react"
import Link from "next/link"
import type { Task } from "@/lib/types"

interface ParticipantMin {
  id: string
  first_name: string
  last_name: string
  pesel?: string | null
}

interface BudgetLine {
  id: string
  task_id: string
  name: string
  sub_number?: string
  line_type?: string
  contractor_name?: string
  total_hours?: number
}

interface SupportForm {
  id: string
  task_id?: string
  code: string
  name: string
  support_type?: string
  meeting_type?: string
  meetings_count?: number
  hours_per_meeting?: number
  hour_type?: string
  contractor_name?: string
  rate_executor?: number
  rate_room?: number
}

export default function NewEventPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [allBudgetLines, setAllBudgetLines] = useState<BudgetLine[]>([])
  const [allSupportForms, setAllSupportForms] = useState<SupportForm[]>([])
  const [allParticipants, setAllParticipants] = useState<ParticipantMin[]>([])
  const [saving, setSaving] = useState(false)

  const [budgetLinesForTask, setBudgetLinesForTask] = useState<BudgetLine[]>([])
  const [supportFormsForTask, setSupportFormsForTask] = useState<SupportForm[]>([])

  const [form, setForm] = useState({
    name: "",
    task_id: "",
    budget_line_id: "",
    support_form_id: "",
    planned_date: "",
    planned_end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    planned_participants_count: "1",
    planned_hours: "",
    planned_cost: "0",
    executor_name: "",
    harmonogram_do_urzedu: false,
    notes: "",
    status: "planned",
  })

  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [participantSearch, setParticipantSearch] = useState("")

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [tasksRes, budgetLinesRes, supportFormsRes, participantsRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("project_id", projectId).order("number"),
      supabase.from("budget_lines").select("id, task_id, name, sub_number, line_type, contractor_name, total_hours").eq("project_id", projectId),
      supabase.from("support_forms").select("*").eq("project_id", projectId),
      supabase.from("participants").select("id, first_name, last_name, pesel").eq("project_id", projectId).order("last_name"),
    ])
    const fetchedTasks = tasksRes.data ?? []
    const fetchedLines = budgetLinesRes.data ?? []
    const fetchedForms = supportFormsRes.data ?? []
    setTasks(fetchedTasks)
    setAllBudgetLines(fetchedLines)
    setAllSupportForms(fetchedForms)
    setAllParticipants(participantsRes.data ?? [])

    // Pre-fill from URL params
    const urlTaskId = searchParams.get("task_id")
    const urlLineId = searchParams.get("budget_line_id")
    if (urlTaskId) {
      const lines = fetchedLines.filter(l => l.task_id === urlTaskId)
      setBudgetLinesForTask(lines)
      setSupportFormsForTask(fetchedForms.filter(sf => sf.task_id === urlTaskId))
      setForm(prev => ({
        ...prev,
        task_id: urlTaskId,
        budget_line_id: urlLineId ?? "",
      }))
    }
  }

  const handleChange = (field: string, value: string | boolean | null) => {
    setForm(prev => ({ ...prev, [field]: value ?? "" }))
  }

  const handleTaskChange = (taskId: string | null) => {
    if (!taskId) return
    setForm(prev => ({ ...prev, task_id: taskId, budget_line_id: "", support_form_id: "", executor_name: "" }))
    setBudgetLinesForTask(allBudgetLines.filter(l => l.task_id === taskId))
    setSupportFormsForTask(allSupportForms.filter(sf => sf.task_id === taskId))
  }

  const handleSupportFormChange = (sfId: string | null) => {
    if (!sfId) return
    const sf = allSupportForms.find(s => s.id === sfId)
    if (!sf) { setForm(prev => ({ ...prev, support_form_id: sfId })); return }
    const hours = sf.hours_per_meeting ?? 0
    const cost = hours * ((sf.rate_executor ?? 0) + (sf.rate_room ?? 0))
    setForm(prev => ({
      ...prev,
      support_form_id: sfId,
      executor_name: sf.contractor_name ?? prev.executor_name,
      planned_hours: hours > 0 ? String(hours) : prev.planned_hours,
      planned_cost: cost > 0 ? String(cost) : prev.planned_cost,
    }))
  }

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const filteredParticipants = allParticipants.filter(p => {
    const q = participantSearch.toLowerCase()
    return p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.pesel && p.pesel.includes(q))
  })

  const selectedParticipantObjects = allParticipants.filter(p => selectedParticipants.includes(p.id))

  // Derive event name suggestion from support form + task
  const selectedTask = tasks.find(t => t.id === form.task_id)
  const selectedSF = allSupportForms.find(s => s.id === form.support_form_id)
  const selectedLine = allBudgetLines.find(l => l.id === form.budget_line_id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { toast.error("Podaj nazwę zdarzenia."); return }
    setSaving(true)

    // Determine event type from support form or line_type
    const eventType = selectedSF?.meeting_type?.toLowerCase().includes("grupow") ? "training"
      : selectedSF?.support_type?.toLowerCase().includes("warsztat") ? "workshop"
      : selectedSF?.support_type?.toLowerCase().includes("konsultacja") ? "consulting"
      : selectedSF?.support_type?.toLowerCase().includes("pośrednictwo") ? "consulting"
      : selectedSF?.support_type?.toLowerCase().includes("mentoring") ? "consulting"
      : "other"

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        project_id: projectId,
        task_id: form.task_id || null,
        budget_line_id: form.budget_line_id || null,
        support_form_id: form.support_form_id || null,
        name: form.name,
        type: eventType,
        status: form.status,
        planned_date: form.planned_date || null,
        planned_end_date: form.planned_end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        planned_participants_count: parseInt(form.planned_participants_count) || 0,
        planned_hours: parseFloat(form.planned_hours) || null,
        planned_cost: parseFloat(form.planned_cost) || 0,
        executor_name: form.executor_name || null,
        harmonogram_do_urzedu: form.harmonogram_do_urzedu,
        notes: form.notes || null,
      })
      .select()
      .single()

    if (error) { setSaving(false); toast.error("Błąd: " + error.message); return }

    if (selectedParticipants.length > 0 && event) {
      await supabase.from("event_participants").insert(
        selectedParticipants.map(pid => ({
          event_id: event.id,
          participant_id: pid,
          status: "planned",
          send_invitation: false,
        }))
      )
    }

    setSaving(false)
    toast.success("Zdarzenie dodane!")
    router.push(`/projects/${projectId}/events`)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Nowe zdarzenie"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Zdarzenia", href: `/projects/${projectId}/events` },
            { label: "Nowe" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            <Link href={`/projects/${projectId}/events`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
              <ArrowLeft className="w-4 h-4" />
              Wróć do zdarzeń
            </Link>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Powiązanie budżetowe – PIERWSZA SEKCJA */}
              <Card>
                <CardHeader>
                  <CardTitle>Zadanie i forma wsparcia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Zadanie */}
                  <div className="space-y-2">
                    <Label>Zadanie projektowe *</Label>
                    <Select value={form.task_id} onValueChange={handleTaskChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz zadanie..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks.map(task => (
                          <SelectItem key={task.id} value={task.id}>
                            Zad. {task.number}: {task.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Podzadanie budżetowe */}
                  {form.task_id && (
                    <div className="space-y-2">
                      <Label>Podzadanie budżetowe</Label>
                      {budgetLinesForTask.length === 0 ? (
                        <p className="text-sm text-slate-400">Brak podzadań – uruchom seed-pns.mjs</p>
                      ) : (
                        <Select value={form.budget_line_id} onValueChange={v => handleChange("budget_line_id", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz pozycję budżetową..." />
                          </SelectTrigger>
                          <SelectContent>
                            {budgetLinesForTask.map(line => (
                              <SelectItem key={line.id} value={line.id}>
                                <span className="font-mono text-slate-500 mr-1 text-xs">{line.sub_number}</span>
                                {line.name}
                                <span className="text-slate-400 ml-1 text-xs">
                                  [{line.line_type === "W" ? "W" : "S"}
                                  {line.contractor_name ? ` · ${line.contractor_name}` : ""}]
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Forma wsparcia */}
                  {form.task_id && (
                    <div className="space-y-2">
                      <Label>Forma wsparcia</Label>
                      {supportFormsForTask.length === 0 ? (
                        <p className="text-sm text-slate-400">Brak form wsparcia dla tego zadania</p>
                      ) : (
                        <Select value={form.support_form_id} onValueChange={handleSupportFormChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz formę wsparcia..." />
                          </SelectTrigger>
                          <SelectContent>
                            {supportFormsForTask.map(sf => (
                              <SelectItem key={sf.id} value={sf.id}>
                                {sf.support_type ?? sf.name}
                                {sf.meeting_type && ` · ${sf.meeting_type}`}
                                {sf.hours_per_meeting ? ` · ${sf.hours_per_meeting}h` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {selectedSF && (
                        <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 flex gap-4">
                          {selectedSF.rate_executor && <span>Stawka: {selectedSF.rate_executor} zł/h</span>}
                          {selectedSF.rate_room && <span>Sala: {selectedSF.rate_room} zł/h</span>}
                          {selectedSF.hour_type && <span>Godz.: {selectedSF.hour_type}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Wykonawca – single select z listy wykonawców form wsparcia */}
                  {form.task_id && (
                    <div className="space-y-2">
                      <Label>Wykonawca / Prowadzący</Label>
                      {(() => {
                        const contractors = [...new Set(
                          supportFormsForTask
                            .map(sf => sf.contractor_name)
                            .filter(Boolean) as string[]
                        )]
                        if (contractors.length === 0) {
                          return (
                            <Input
                              placeholder="Nazwa wykonawcy..."
                              value={form.executor_name}
                              onChange={e => handleChange("executor_name", e.target.value)}
                            />
                          )
                        }
                        return (
                          <Select value={form.executor_name} onValueChange={v => handleChange("executor_name", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz wykonawcę..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contractors.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Podstawowe informacje */}
              <Card>
                <CardHeader>
                  <CardTitle>Szczegóły zdarzenia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nazwa zdarzenia *</Label>
                    <Input
                      id="name"
                      placeholder={
                        selectedSF && selectedTask
                          ? `${selectedSF.support_type ?? selectedSF.name} – Zad.${selectedTask.number} – sesja 1`
                          : "np. Warsztaty dla kobiet – edycja 3"
                      }
                      value={form.name}
                      onChange={e => handleChange("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={v => handleChange("status", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Szkic</SelectItem>
                          <SelectItem value="planned">Zaplanowane</SelectItem>
                          <SelectItem value="accepted">Zatwierdzone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Liczba godzin</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="np. 2"
                        value={form.planned_hours}
                        onChange={e => handleChange("planned_hours", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Koszt – tylko jeśli nie pochodzi z formy wsparcia */}
                  {!selectedSF && (
                    <div className="space-y-2">
                      <Label>Planowany koszt (zł)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.planned_cost}
                        onChange={e => handleChange("planned_cost", e.target.value)}
                      />
                    </div>
                  )}
                  {selectedSF && parseFloat(form.planned_cost) > 0 && (
                    <div className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded p-2">
                      Planowany koszt (auto): <strong>{parseFloat(form.planned_cost).toLocaleString("pl", { style: "currency", currency: "PLN" })}</strong>
                      <span className="text-xs text-slate-400 ml-2">({form.planned_hours}h × stawki z formy wsparcia)</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Data i miejsce */}
              <Card>
                <CardHeader>
                  <CardTitle>Data i miejsce</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data planowana</Label>
                      <Input type="date" value={form.planned_date} onChange={e => handleChange("planned_date", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Data zakończenia</Label>
                      <Input type="date" value={form.planned_end_date} onChange={e => handleChange("planned_end_date", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Godzina od</Label>
                      <Input type="time" value={form.start_time} onChange={e => handleChange("start_time", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Godzina do</Label>
                      <Input type="time" value={form.end_time} onChange={e => handleChange("end_time", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Miejsce</Label>
                    <Input
                      placeholder="np. ul. Bierutowska 57-59, Wrocław"
                      value={form.location}
                      onChange={e => handleChange("location", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="harmonogram"
                      checked={form.harmonogram_do_urzedu}
                      onChange={e => handleChange("harmonogram_do_urzedu", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <Label htmlFor="harmonogram" className="cursor-pointer">Ujmij w harmonogramie do urzędu</Label>
                  </div>
                </CardContent>
              </Card>

              {/* Uczestnicy */}
              <Card>
                <CardHeader>
                  <CardTitle>Uczestnicy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Planowana liczba uczestników</Label>
                    <Input
                      type="number" min="0"
                      value={form.planned_participants_count}
                      onChange={e => handleChange("planned_participants_count", e.target.value)}
                    />
                  </div>

                  {selectedParticipantObjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedParticipantObjects.map(p => (
                        <Badge key={p.id} variant="secondary" className="pr-1 flex items-center gap-1">
                          {p.first_name} {p.last_name}
                          <button type="button" onClick={() => toggleParticipant(p.id)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Input
                      placeholder="Szukaj uczestnika (nazwisko, PESEL)..."
                      value={participantSearch}
                      onChange={e => setParticipantSearch(e.target.value)}
                      className="text-sm"
                    />
                    {participantSearch && (
                      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                        {filteredParticipants.length === 0 ? (
                          <p className="text-sm text-slate-400 p-3">Brak wyników</p>
                        ) : (
                          filteredParticipants.slice(0, 20).map(p => {
                            const selected = selectedParticipants.includes(p.id)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleParticipant(p.id)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${selected ? "bg-blue-50" : ""}`}
                              >
                                <span>{p.last_name} {p.first_name}</span>
                                {selected && <span className="text-xs text-blue-600 font-medium">✓</span>}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Notatki</CardTitle></CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Dodatkowe informacje..."
                    value={form.notes}
                    onChange={e => handleChange("notes", e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Zapisuję...</> : "Utwórz zdarzenie"}
                </Button>
                <Link href={`/projects/${projectId}/events`}>
                  <Button type="button" variant="outline">Anuluj</Button>
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
