"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import type { Task, Staff } from "@/lib/types"

export default function NewEventPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [saving, setSaving] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    type: "training",
    task_id: "",
    planned_date: "",
    planned_end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    planned_participants_count: "0",
    planned_cost: "0",
    send_invitations: false,
    harmonogram_do_urzedu: false,
    notes: "",
    status: "draft",
  })

  const [selectedStaff, setSelectedStaff] = useState<string>("")
  const [staffRole, setStaffRole] = useState("")
  const [staffRate, setStaffRate] = useState("")
  const [staffHours, setStaffHours] = useState("")
  const [addedStaff, setAddedStaff] = useState<Array<{ staff_id: string; name: string; role: string; rate: string; hours: string }>>([])

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [tasksRes, staffRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("project_id", projectId).order("number"),
      supabase.from("staff").select("*").order("name"),
    ])
    setTasks(tasksRes.data ?? [])
    setStaffList(staffRes.data ?? [])
  }

  const handleChange = (field: string, value: string | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }))
  }

  const checkStaffConflict = async (staffId: string, date: string) => {
    if (!staffId || !date) return
    const { data } = await supabase
      .from("event_staff")
      .select("*, event:events(id, name, planned_date, start_time, end_time)")
      .eq("staff_id", staffId)
      .not("event.planned_date", "is", null)

    const conflicts = data?.filter((es: { event?: { planned_date?: string; name?: string } | null }) =>
      es.event?.planned_date === date
    )

    if (conflicts && conflicts.length > 0) {
      const names = conflicts.map((c: { event?: { name?: string } | null }) => c.event?.name ?? "inne zdarzenie").join(", ")
      setConflictWarning(`Uwaga: ta osoba jest już przypisana do: ${names}`)
    } else {
      setConflictWarning(null)
    }
  }

  const handleAddStaff = async () => {
    if (!selectedStaff) { toast.error("Wybierz osobę."); return }
    const person = staffList.find((s) => s.id === selectedStaff)
    if (!person) return

    // Check conflict
    if (form.planned_date) {
      await checkStaffConflict(selectedStaff, form.planned_date)
    }

    setAddedStaff((prev) => [
      ...prev,
      { staff_id: selectedStaff, name: person.name, role: staffRole, rate: staffRate, hours: staffHours },
    ])
    setSelectedStaff("")
    setStaffRole("")
    setStaffRate("")
    setStaffHours("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.type) {
      toast.error("Podaj nazwę i typ zdarzenia.")
      return
    }
    setSaving(true)

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        project_id: projectId,
        task_id: form.task_id || null,
        name: form.name,
        type: form.type,
        status: form.status,
        planned_date: form.planned_date || null,
        planned_end_date: form.planned_end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        planned_participants_count: parseInt(form.planned_participants_count) || 0,
        planned_cost: parseFloat(form.planned_cost) || 0,
        send_invitations: form.send_invitations,
        harmonogram_do_urzedu: form.harmonogram_do_urzedu,
        notes: form.notes || null,
      })
      .select()
      .single()

    if (error) {
      setSaving(false)
      toast.error("Błąd: " + error.message)
      return
    }

    // Add staff
    if (addedStaff.length > 0 && event) {
      await supabase.from("event_staff").insert(
        addedStaff.map((s) => ({
          event_id: event.id,
          staff_id: s.staff_id,
          role: s.role || null,
          rate: parseFloat(s.rate) || null,
          hours_planned: parseFloat(s.hours) || null,
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
              <Card>
                <CardHeader>
                  <CardTitle>Podstawowe informacje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nazwa zdarzenia *</Label>
                    <Input
                      id="name"
                      placeholder="Szkolenie dla pielęgniarek – edycja 1"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Typ zdarzenia</Label>
                      <Select value={form.type} onValueChange={(v) => handleChange("type", v)}>
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="training">📚 Szkolenie</SelectItem>
                          <SelectItem value="workshop">🛠️ Warsztat</SelectItem>
                          <SelectItem value="conference">🎤 Konferencja</SelectItem>
                          <SelectItem value="consulting">💬 Konsultacja</SelectItem>
                          <SelectItem value="production">🎬 Produkcja filmowa</SelectItem>
                          <SelectItem value="podcast">🎙️ Podcast</SelectItem>
                          <SelectItem value="other">📌 Inne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status początkowy</Label>
                      <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Szkic</SelectItem>
                          <SelectItem value="planned">Zaplanowane</SelectItem>
                          <SelectItem value="accepted">Zatwierdzone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task_id">Powiąż z zadaniem</Label>
                    <Select value={form.task_id} onValueChange={(v) => handleChange("task_id", v)}>
                      <SelectTrigger id="task_id">
                        <SelectValue placeholder="Wybierz zadanie (opcjonalne)" />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            Zadanie {task.number}: {task.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data i miejsce</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data planowana</Label>
                      <Input
                        type="date"
                        value={form.planned_date}
                        onChange={(e) => handleChange("planned_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data zakończenia (jeśli wielodniowe)</Label>
                      <Input
                        type="date"
                        value={form.planned_end_date}
                        onChange={(e) => handleChange("planned_end_date", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Godzina od</Label>
                      <Input
                        type="time"
                        value={form.start_time}
                        onChange={(e) => handleChange("start_time", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Godzina do</Label>
                      <Input
                        type="time"
                        value={form.end_time}
                        onChange={(e) => handleChange("end_time", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Miejsce</Label>
                    <Input
                      placeholder="Hotel Dziki Potok, Karpacz"
                      value={form.location}
                      onChange={(e) => handleChange("location", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Uczestnicy i koszty</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Planowana liczba uczestników</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.planned_participants_count}
                        onChange={(e) => handleChange("planned_participants_count", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Planowany koszt (zł)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.planned_cost}
                        onChange={(e) => handleChange("planned_cost", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="send_invitations"
                        checked={form.send_invitations}
                        onChange={(e) => handleChange("send_invitations", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <Label htmlFor="send_invitations" className="cursor-pointer">
                        Wyślij zaproszenia do uczestników
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="harmonogram"
                        checked={form.harmonogram_do_urzedu}
                        onChange={(e) => handleChange("harmonogram_do_urzedu", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <Label htmlFor="harmonogram" className="cursor-pointer">
                        Ujmij w harmonogramie do urzędu
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Staff section */}
              <Card>
                <CardHeader>
                  <CardTitle>Prowadzący / Eksperci</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {addedStaff.length > 0 && (
                    <div className="space-y-2">
                      {addedStaff.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                          <span className="font-medium">{s.name}</span>
                          <div className="flex items-center gap-3 text-slate-500">
                            {s.role && <span>{s.role}</span>}
                            {s.rate && <span>{s.rate} zł/h</span>}
                            {s.hours && <span>{s.hours}h</span>}
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-600 text-xs"
                              onClick={() => setAddedStaff((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Usuń
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {conflictWarning && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {conflictWarning}
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <Select value={selectedStaff} onValueChange={(v) => setSelectedStaff(v ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz osobę..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.role && `(${s.role})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Rola"
                        value={staffRole}
                        onChange={(e) => setStaffRole(e.target.value)}
                      />
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        placeholder="Stawka zł/h"
                        value={staffRate}
                        onChange={(e) => setStaffRate(e.target.value)}
                      />
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        placeholder="Godziny"
                        value={staffHours}
                        onChange={(e) => setStaffHours(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddStaff}
                    >
                      Dodaj osobę
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notatki</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Dodatkowe informacje..."
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Zapisuję...
                    </>
                  ) : (
                    "Utwórz zdarzenie"
                  )}
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
