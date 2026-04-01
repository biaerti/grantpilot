"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EventStatusBadge } from "@/components/events/event-status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatDateShort, eventTypeLabel } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Filter, Users, Calendar, Wallet, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import type { Event, EventStatus, Project } from "@/lib/types"

const TYPE_ICONS: Record<string, string> = {
  training: "📚",
  workshop: "🛠️",
  conference: "🎤",
  consulting: "💬",
  production: "🎬",
  podcast: "🎙️",
  other: "📌",
}

export default function EventsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null })
  const [settleDialog, setSettleDialog] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null })
  const [completingData, setCompletingData] = useState({ actual_participants_count: "", actual_cost: "", notes: "" })
  const [settleData, setSettleData] = useState({ amount: "", description: "", notes_for_accountant: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [projectRes, eventsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("events").select("*, task:tasks(id,number,name)").eq("project_id", projectId).order("planned_date", { ascending: false }),
    ])
    setProject(projectRes.data)
    setEvents(eventsRes.data ?? [])
    setLoading(false)
  }

  const filteredEvents = filterStatus === "all"
    ? events
    : events.filter((e) => e.status === filterStatus)

  const statusCounts = events.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleStatusChange = async (eventId: string, newStatus: EventStatus) => {
    const { error } = await supabase
      .from("events")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", eventId)

    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: newStatus } : e))
    toast.success("Status zaktualizowany.")
  }

  const handleMarkCompleted = async () => {
    if (!completeDialog.event) return
    setSaving(true)

    const { error } = await supabase
      .from("events")
      .update({
        status: "completed",
        actual_date: completeDialog.event.planned_date,
        actual_participants_count: parseInt(completingData.actual_participants_count) || completeDialog.event.planned_participants_count,
        actual_cost: parseFloat(completingData.actual_cost) || completeDialog.event.planned_cost,
        notes: completingData.notes || completeDialog.event.notes,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", completeDialog.event.id)

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }

    setEvents((prev) =>
      prev.map((e) =>
        e.id === completeDialog.event!.id
          ? {
              ...e,
              status: "completed" as EventStatus,
              actual_participants_count: parseInt(completingData.actual_participants_count) || e.planned_participants_count,
              actual_cost: parseFloat(completingData.actual_cost) || e.planned_cost,
            }
          : e
      )
    )
    setCompleteDialog({ open: false, event: null })
    setCompletingData({ actual_participants_count: "", actual_cost: "", notes: "" })
    toast.success("Zdarzenie oznaczone jako zrealizowane!")
  }

  const handleSettle = async () => {
    if (!settleDialog.event) return
    if (!settleData.amount || !settleData.description) {
      toast.error("Podaj kwotę i opis do faktury.")
      return
    }
    setSaving(true)

    // Create accounting request
    const { data: reqData, error: reqError } = await supabase
      .from("accounting_requests")
      .insert({
        project_id: projectId,
        event_id: settleDialog.event.id,
        amount: parseFloat(settleData.amount),
        description: settleData.description,
        notes_for_accountant: settleData.notes_for_accountant || null,
        status: "pending",
        details: {
          participants: settleDialog.event.actual_participants_count ?? settleDialog.event.planned_participants_count,
          event_type: settleDialog.event.type,
          event_date: settleDialog.event.actual_date ?? settleDialog.event.planned_date,
        },
      })
      .select()
      .single()

    if (reqError) { setSaving(false); toast.error("Błąd: " + reqError.message); return }

    const { error } = await supabase
      .from("events")
      .update({
        status: "settled",
        settled_at: new Date().toISOString(),
        accounting_request_id: reqData.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settleDialog.event.id)

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }

    setEvents((prev) =>
      prev.map((e) =>
        e.id === settleDialog.event!.id ? { ...e, status: "settled" as EventStatus } : e
      )
    )
    setSettleDialog({ open: false, event: null })
    setSettleData({ amount: "", description: "", notes_for_accountant: "" })
    toast.success("Zlecenie rozliczeniowe wysłane do Kamili!")
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Zdarzenia"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Zdarzenia" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Filter bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { value: "all", label: "Wszystkie", count: events.length },
                { value: "planned", label: "Zaplanowane", count: statusCounts.planned ?? 0 },
                { value: "accepted", label: "Zatwierdzone", count: statusCounts.accepted ?? 0 },
                { value: "completed", label: "Zrealizowane", count: statusCounts.completed ?? 0 },
                { value: "settled", label: "Rozliczone", count: statusCounts.settled ?? 0 },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilterStatus(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === f.value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {f.label} {f.count > 0 && <span className="ml-1 opacity-75">({f.count})</span>}
                </button>
              ))}
            </div>
            <Link href={`/projects/${projectId}/events/new`}>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Nowe zdarzenie
              </Button>
            </Link>
          </div>

          {/* Events list */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                {filterStatus === "all"
                  ? "Brak zdarzeń. Dodaj pierwsze zdarzenie projektu."
                  : "Brak zdarzeń z wybranym statusem."}
                {filterStatus === "all" && (
                  <div className="mt-2">
                    <Link href={`/projects/${projectId}/events/new`} className="text-blue-600 text-sm">
                      Dodaj zdarzenie →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <Card key={event.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl flex-shrink-0">{TYPE_ICONS[event.type] ?? "📌"}</span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900">{event.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDateShort(event.planned_date)}
                              {event.start_time && ` ${event.start_time}`}
                            </span>
                            {event.location && (
                              <span>📍 {event.location}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {event.actual_participants_count ?? event.planned_participants_count} os.
                            </span>
                            <span className="flex items-center gap-1">
                              <Wallet className="w-3.5 h-3.5" />
                              {formatCurrency(event.actual_cost ?? event.planned_cost)}
                            </span>
                          </div>
                          {(event as unknown as { task?: { number: number; name: string } }).task && (
                            <p className="text-xs text-slate-400 mt-1">
                              Zad. {(event as unknown as { task: { number: number; name: string } }).task.number}: {(event as unknown as { task: { number: number; name: string } }).task.name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <EventStatusBadge status={event.status} />

                        {/* Action buttons based on status */}
                        {event.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(event.id, "planned")}
                          >
                            Zatwierdź plan
                          </Button>
                        )}
                        {event.status === "planned" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(event.id, "accepted")}
                          >
                            Potwierdź
                          </Button>
                        )}
                        {event.status === "accepted" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setCompletingData({
                                actual_participants_count: String(event.planned_participants_count),
                                actual_cost: String(event.planned_cost),
                                notes: event.notes ?? "",
                              })
                              setCompleteDialog({ open: true, event })
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Zrealizowano
                          </Button>
                        )}
                        {event.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-purple-300 text-purple-700 hover:bg-purple-50"
                            onClick={() => {
                              setSettleData({
                                amount: String(event.actual_cost ?? event.planned_cost),
                                description: `${eventTypeLabel(event.type)}: ${event.name} (${formatDateShort(event.actual_date ?? event.planned_date)}, ${event.actual_participants_count ?? event.planned_participants_count} os.)`,
                                notes_for_accountant: "",
                              })
                              setSettleDialog({ open: true, event })
                            }}
                          >
                            Rozlicz
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Complete event dialog */}
      <Dialog open={completeDialog.open} onOpenChange={(open) => !open && setCompleteDialog({ open: false, event: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Oznacz jako zrealizowane</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Zdarzenie: <strong>{completeDialog.event?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Rzeczywista liczba uczestników</Label>
              <Input
                type="number"
                value={completingData.actual_participants_count}
                onChange={(e) => setCompletingData((p) => ({ ...p, actual_participants_count: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rzeczywisty koszt (zł)</Label>
              <Input
                type="number"
                step="0.01"
                value={completingData.actual_cost}
                onChange={(e) => setCompletingData((p) => ({ ...p, actual_cost: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notatki (opcjonalne)</Label>
              <Textarea
                value={completingData.notes}
                onChange={(e) => setCompletingData((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog({ open: false, event: null })}>Anuluj</Button>
            <Button onClick={handleMarkCompleted} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Potwierdź realizację
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle event dialog */}
      <Dialog open={settleDialog.open} onOpenChange={(open) => !open && setSettleDialog({ open: false, event: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wyślij zlecenie do księgowej</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Zlecenie zostanie wysłane do Kamili do wystawienia faktury.
            </p>
            <div className="space-y-2">
              <Label>Kwota do zafakturowania (zł) *</Label>
              <Input
                type="number"
                step="0.01"
                value={settleData.amount}
                onChange={(e) => setSettleData((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Opis do faktury *</Label>
              <Textarea
                value={settleData.description}
                onChange={(e) => setSettleData((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Pełny opis usługi do wpisania na fakturze..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notatka dla Kamili (opcjonalne)</Label>
              <Textarea
                value={settleData.notes_for_accountant}
                onChange={(e) => setSettleData((p) => ({ ...p, notes_for_accountant: e.target.value }))}
                rows={2}
                placeholder="Dodatkowe instrukcje..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialog({ open: false, event: null })}>Anuluj</Button>
            <Button onClick={handleSettle} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Wyślij zlecenie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
