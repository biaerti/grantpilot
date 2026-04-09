"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { EventStatusBadge } from "@/components/events/event-status-badge"
import { formatCurrency, formatDateShort, eventTypeLabel, computeEventDisplayStatus } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Users, Calendar, Wallet, CheckCircle, Loader2, Pencil, X, Search, CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO } from "date-fns"
import { pl } from "date-fns/locale"
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

interface EventWithTask extends Event {
  task?: { id: string; number: number; name: string } | null
  event_participants?: { participant?: { id: string; first_name: string; last_name: string } | null }[]
}

interface ParticipantMin {
  id: string
  first_name: string
  last_name: string
}

export default function EventsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [events, setEvents] = useState<EventWithTask[]>([])
  const [participants, setParticipants] = useState<ParticipantMin[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [calDate, setCalDate] = useState(new Date())

  // Filters - init from URL params
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterParticipant, setFilterParticipant] = useState<string>(() => searchParams?.get("participant_id") ?? "all")
  const [filterLocation, setFilterLocation] = useState<string>("all")
  const [searchText, setSearchText] = useState("")

  // Dialogs
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; event: EventWithTask | null }>({ open: false, event: null })
  const [settleDialog, setSettleDialog] = useState<{ open: boolean; event: EventWithTask | null }>({ open: false, event: null })
  const [editDialog, setEditDialog] = useState<{ open: boolean; event: EventWithTask | null }>({ open: false, event: null })

  const [completingData, setCompletingData] = useState({ actual_participants_count: "", actual_cost: "", notes: "" })
  const [settleData, setSettleData] = useState({ amount: "", description: "", notes_for_accountant: "" })
  const [editData, setEditData] = useState({
    name: "", planned_date: "", planned_end_date: "", start_time: "", end_time: "",
    location: "", planned_participants_count: "", planned_cost: "", notes: "", status: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [projectId])

  async function fetchData() {
    const [projectRes, eventsRes, participantsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("events")
        .select("*, task:tasks(id,number,name), event_participants(participant:participants(id,first_name,last_name))")
        .eq("project_id", projectId)
        .order("planned_date", { ascending: false }),
      supabase.from("participants").select("id, first_name, last_name").eq("project_id", projectId).order("last_name"),
    ])
    setProject(projectRes.data)
    setEvents((eventsRes.data ?? []) as unknown as EventWithTask[])
    setParticipants(participantsRes.data ?? [])
    setLoading(false)
  }

  // Unique locations from events
  const uniqueLocations = [...new Set(events.map(e => e.location).filter(Boolean) as string[])].sort()

  // Apply all filters
  const filteredEvents = events.filter(ev => {
    if (filterStatus !== "all" && getDisplayStatus(ev) !== filterStatus) return false
    if (filterLocation !== "all" && ev.location !== filterLocation) return false
    if (filterParticipant !== "all") {
      const pIds = ev.event_participants?.map(ep => ep.participant?.id).filter(Boolean) ?? []
      if (!pIds.includes(filterParticipant)) return false
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      if (!ev.name.toLowerCase().includes(q) && !(ev.location ?? "").toLowerCase().includes(q)) return false
    }
    return true
  })

  // Oblicz display-status (in_progress gdy zdarzenie trwa dziś)
  const getDisplayStatus = (e: EventWithTask) =>
    computeEventDisplayStatus(e.status, e.planned_date, e.planned_end_date)

  const statusCounts = events.reduce((acc, e) => {
    const ds = getDisplayStatus(e)
    acc[ds] = (acc[ds] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const hasFilters = filterParticipant !== "all" || filterLocation !== "all" || searchText.trim() !== ""

  // Calendar helpers
  const calDays = useMemo(() => {
    const monthStart = startOfMonth(calDate)
    const monthEnd = endOfMonth(calDate)
    const start = startOfWeek(monthStart, { weekStartsOn: 1 })
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days: Date[] = []
    let d = start
    while (d <= end) { days.push(d); d = addDays(d, 1) }
    return days
  }, [calDate])

  const getEventsForDay = (date: Date) =>
    filteredEvents.filter(e => e.planned_date && isSameDay(parseISO(e.planned_date), date))

  const STATUS_COLOR: Record<string, string> = {
    draft: "bg-slate-300",
    planned: "bg-blue-400",
    accepted: "bg-blue-400",
    in_progress: "bg-amber-400",
    completed: "bg-green-500",
    settled: "bg-slate-400",
  }

  const handleStatusChange = async (eventId: string, newStatus: EventStatus) => {
    const { error } = await supabase.from("events").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", eventId)
    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: newStatus } : e))
    toast.success("Status zaktualizowany.")
  }

  const openEdit = (event: EventWithTask) => {
    setEditData({
      name: event.name,
      planned_date: event.planned_date?.slice(0, 10) ?? "",
      planned_end_date: event.planned_end_date?.slice(0, 10) ?? "",
      start_time: event.start_time ?? "",
      end_time: event.end_time ?? "",
      location: event.location ?? "",
      planned_participants_count: String(event.planned_participants_count ?? ""),
      planned_cost: String(event.planned_cost ?? ""),
      notes: event.notes ?? "",
      status: event.status,
    })
    setEditDialog({ open: true, event })
  }

  const handleEdit = async () => {
    if (!editDialog.event || !editData.name.trim()) { toast.error("Podaj nazwę zdarzenia."); return }
    setSaving(true)
    const { error } = await supabase.from("events").update({
      name: editData.name,
      planned_date: editData.planned_date || null,
      planned_end_date: editData.planned_end_date || null,
      start_time: editData.start_time || null,
      end_time: editData.end_time || null,
      location: editData.location || null,
      planned_participants_count: parseInt(editData.planned_participants_count) || 0,
      planned_cost: parseFloat(editData.planned_cost) || 0,
      notes: editData.notes || null,
      status: editData.status as EventStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", editDialog.event.id)
    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents(prev => prev.map(e => e.id === editDialog.event!.id ? {
      ...e,
      name: editData.name,
      planned_date: editData.planned_date || e.planned_date,
      planned_end_date: editData.planned_end_date || undefined,
      start_time: editData.start_time || undefined,
      end_time: editData.end_time || undefined,
      location: editData.location || undefined,
      planned_participants_count: parseInt(editData.planned_participants_count) || e.planned_participants_count,
      planned_cost: parseFloat(editData.planned_cost) || e.planned_cost,
      notes: editData.notes || undefined,
      status: editData.status as EventStatus,
    } : e))
    setEditDialog({ open: false, event: null })
    toast.success("Zdarzenie zaktualizowane!")
  }

  const handleDelete = async (eventId: string, name: string) => {
    if (!confirm(`Usunąć zdarzenie "${name}"?`)) return
    const { error } = await supabase.from("events").delete().eq("id", eventId)
    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents(prev => prev.filter(e => e.id !== eventId))
    toast.success("Usunięto.")
  }

  const handleSplit = async (event: EventWithTask) => {
    const eps = event.event_participants ?? []
    if (eps.length < 2) return
    if (!confirm(`Podzielić to zdarzenie na ${eps.length} osobne zdarzenia (po jednym na uczestnika)?`)) return
    const baseName = event.name.replace(/\s*\(.*?\)\s*$/, "").trim()
    // Fetch full event data
    const { data: fullEvent } = await supabase.from("events").select("*").eq("id", event.id).single()
    if (!fullEvent) { toast.error("Błąd pobierania zdarzenia."); return }
    for (const ep of eps) {
      if (!ep.participant) continue
      const { last_name, first_name } = ep.participant
      const { data: newEv, error: insErr } = await supabase.from("events").insert({
        project_id: fullEvent.project_id,
        task_id: fullEvent.task_id,
        budget_line_id: fullEvent.budget_line_id,
        support_form_id: fullEvent.support_form_id,
        name: `${baseName} (${last_name} ${first_name})`,
        type: fullEvent.type,
        status: fullEvent.status,
        planned_date: fullEvent.planned_date,
        planned_end_date: fullEvent.planned_end_date,
        start_time: fullEvent.start_time,
        end_time: fullEvent.end_time,
        location: fullEvent.location,
        planned_participants_count: 1,
        planned_hours: fullEvent.planned_hours,
        planned_cost: fullEvent.planned_cost,
        executor_name: fullEvent.executor_name,
        contract_id: fullEvent.contract_id,
        notes: fullEvent.notes,
      }).select().single()
      if (insErr) { toast.error("Błąd tworzenia: " + insErr.message); return }
      await supabase.from("event_participants").insert({
        event_id: newEv.id,
        participant_id: ep.participant.id,
        status: "planned",
        send_invitation: false,
      })
    }
    // Delete original
    await supabase.from("events").delete().eq("id", event.id)
    toast.success(`Podzielono na ${eps.length} zdarzenia!`)
    fetchData()
  }

  const handleMarkCompleted = async () => {
    if (!completeDialog.event) return
    setSaving(true)
    const { error } = await supabase.from("events").update({
      status: "completed",
      actual_date: completeDialog.event.planned_date,
      actual_participants_count: parseInt(completingData.actual_participants_count) || completeDialog.event.planned_participants_count,
      actual_cost: parseFloat(completingData.actual_cost) || completeDialog.event.planned_cost,
      notes: completingData.notes || completeDialog.event.notes,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", completeDialog.event.id)
    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents(prev => prev.map(e => e.id === completeDialog.event!.id ? {
      ...e, status: "completed" as EventStatus,
      actual_participants_count: parseInt(completingData.actual_participants_count) || e.planned_participants_count,
      actual_cost: parseFloat(completingData.actual_cost) || e.planned_cost,
    } : e))
    setCompleteDialog({ open: false, event: null })
    setCompletingData({ actual_participants_count: "", actual_cost: "", notes: "" })
    toast.success("Zdarzenie oznaczone jako zrealizowane!")
  }

  const handleSettle = async () => {
    if (!settleDialog.event) return
    if (!settleData.amount || !settleData.description) { toast.error("Podaj kwotę i opis do faktury."); return }
    setSaving(true)
    const { data: reqData, error: reqError } = await supabase.from("accounting_requests").insert({
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
    }).select().single()
    if (reqError) { setSaving(false); toast.error("Błąd: " + reqError.message); return }
    const { error } = await supabase.from("events").update({
      status: "settled", settled_at: new Date().toISOString(),
      accounting_request_id: reqData.id, updated_at: new Date().toISOString(),
    }).eq("id", settleDialog.event.id)
    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents(prev => prev.map(e => e.id === settleDialog.event!.id ? { ...e, status: "settled" as EventStatus } : e))
    setSettleDialog({ open: false, event: null })
    setSettleData({ amount: "", description: "", notes_for_accountant: "" })
    toast.success("Zlecenie rozliczeniowe wysłane!")
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
          {/* Status filter tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { value: "all", label: "Wszystkie", count: events.length },
                { value: "planned", label: "Zaplanowane", count: statusCounts.planned ?? 0 },
                { value: "in_progress", label: "W realizacji", count: statusCounts.in_progress ?? 0 },
                { value: "completed", label: "Zrealizowane", count: statusCounts.completed ?? 0 },
                { value: "settled", label: "Rozliczone", count: statusCounts.settled ?? 0 },
              ].map(f => (
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
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 flex items-center gap-1 text-sm transition-colors ${viewMode === "list" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  <List className="w-3.5 h-3.5" />Lista
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`px-3 py-1.5 flex items-center gap-1 text-sm transition-colors ${viewMode === "calendar" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />Kalendarz
                </button>
              </div>
              <Link href={`/projects/${projectId}/events/new`}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Nowe zdarzenie
                </Button>
              </Link>
            </div>
          </div>

          {/* Additional filters */}
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Szukaj nazwy / miejsca..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-8 h-9 w-52 text-sm"
              />
            </div>

            {/* Filter by participant */}
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Uczestnik</p>
              <Select value={filterParticipant} onValueChange={v => setFilterParticipant(v ?? "all")}>
                <SelectTrigger className="h-9 w-48 text-sm">
                  <SelectValue placeholder="Wszyscy..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy uczestnicy</SelectItem>
                  {participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.last_name} {p.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter by location */}
            {uniqueLocations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Sala / miejsce</p>
                <Select value={filterLocation} onValueChange={v => setFilterLocation(v ?? "all")}>
                  <SelectTrigger className="h-9 w-56 text-sm">
                    <SelectValue placeholder="Wszystkie miejsca..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie miejsca</SelectItem>
                    {uniqueLocations.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-slate-400 hover:text-slate-700"
                onClick={() => { setFilterParticipant("all"); setFilterLocation("all"); setSearchText("") }}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Wyczyść
              </Button>
            )}

            {hasFilters && (
              <p className="text-xs text-slate-400 self-end pb-1">{filteredEvents.length} z {events.length} zdarzeń</p>
            )}
          </div>

          {/* Events - list or calendar */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : viewMode === "calendar" ? (
            <Card>
              <CardContent className="p-4">
                {/* Calendar header */}
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCalDate(d => subMonths(d, 1))} className="p-1 hover:bg-slate-100 rounded">
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                  </button>
                  <h2 className="text-base font-semibold text-slate-800 capitalize">
                    {format(calDate, "LLLL yyyy", { locale: pl })}
                  </h2>
                  <button onClick={() => setCalDate(d => addMonths(d, 1))} className="p-1 hover:bg-slate-100 rounded">
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                {/* Day names */}
                <div className="grid grid-cols-7 mb-1">
                  {["Pn","Wt","Śr","Cz","Pt","Sb","Nd"].map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 border-l border-t">
                  {calDays.map((day, i) => {
                    const dayEvents = getEventsForDay(day)
                    const isToday = isSameDay(day, new Date())
                    const isCurrentMonth = isSameMonth(day, calDate)
                    return (
                      <div key={i} className={`border-r border-b min-h-20 p-1 ${!isCurrentMonth ? "bg-slate-50" : ""}`}>
                        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? "bg-blue-600 text-white" : isCurrentMonth ? "text-slate-700" : "text-slate-300"
                        }`}>
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <div key={ev.id}
                              className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer text-white ${STATUS_COLOR[getDisplayStatus(ev)] ?? "bg-slate-400"}`}
                              title={ev.name}
                              onClick={() => {
                                setViewMode("list")
                                setSearchText(ev.name.slice(0, 10))
                              }}
                            >
                              {ev.start_time ? ev.start_time.slice(0, 5) + " " : ""}{ev.name}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-slate-400 pl-1">+{dayEvents.length - 3} więcej</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t flex-wrap">
                  {Object.entries({ planned: "Zaplanowane", in_progress: "W realizacji", completed: "Zrealizowane", settled: "Rozliczone" }).map(([s, label]) => (
                    <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className={`w-3 h-3 rounded ${STATUS_COLOR[s]}`} />
                      {label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                {hasFilters || filterStatus !== "all"
                  ? "Brak zdarzeń pasujących do filtrów."
                  : "Brak zdarzeń. Dodaj pierwsze zdarzenie projektu."}
                {!hasFilters && filterStatus === "all" && (
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
              {filteredEvents.map(event => (
                <Card key={event.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl flex-shrink-0">{TYPE_ICONS[event.type] ?? "📌"}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900">{event.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDateShort(event.planned_date)}
                              {event.start_time && ` ${event.start_time}`}
                            </span>
                            {event.location && <span>📍 {event.location}</span>}
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {event.actual_participants_count ?? event.planned_participants_count} os.
                            </span>
                            <span className="flex items-center gap-1">
                              <Wallet className="w-3.5 h-3.5" />
                              {formatCurrency(event.actual_cost ?? event.planned_cost)}
                            </span>
                          </div>
                          {event.task && (
                            <p className="text-xs text-slate-400 mt-1">
                              Zad. {event.task.number}: {event.task.name}
                            </p>
                          )}
                          {event.event_participants && event.event_participants.length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {event.event_participants.slice(0, 3).map(ep => ep.participant ? `${ep.participant.last_name} ${ep.participant.first_name}` : null).filter(Boolean).join(", ")}
                              {event.event_participants.length > 3 && ` +${event.event_participants.length - 3}`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <EventStatusBadge status={getDisplayStatus(event)} />

                        {/* Edit button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                          onClick={() => openEdit(event)}
                          title="Edytuj zdarzenie"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        {/* Podziel – dla zdarzeń indywidualnych z >1 uczestnikiem */}
                        {(event.event_participants?.length ?? 0) > 1 &&
                          !["training", "workshop", "conference"].includes(event.type) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                            onClick={() => handleSplit(event)}
                            title="Podziel na osobne zdarzenia"
                          >
                            Podziel
                          </Button>
                        )}

                        {/* Status action buttons */}
                        {event.status === "draft" && (
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(event.id, "planned")}>
                            Zatwierdź plan
                          </Button>
                        )}
                        {(event.status === "planned" || event.status === "accepted" || event.status === "in_progress") && (
                          <Button size="sm" onClick={() => {
                            setCompletingData({
                              actual_participants_count: String(event.planned_participants_count),
                              actual_cost: String(event.planned_cost),
                              notes: event.notes ?? "",
                            })
                            setCompleteDialog({ open: true, event })
                          }}>
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

      {/* Edit event dialog */}
      <Dialog open={editDialog.open} onOpenChange={open => !open && setEditDialog({ open: false, event: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edytuj zdarzenie</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nazwa *</Label>
              <Input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data rozpoczęcia</Label>
                <Input type="date" value={editData.planned_date} onChange={e => setEditData(p => ({ ...p, planned_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data zakończenia</Label>
                <Input type="date" value={editData.planned_end_date} onChange={e => setEditData(p => ({ ...p, planned_end_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Godzina od</Label>
                <Input type="time" value={editData.start_time} onChange={e => setEditData(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Godzina do</Label>
                <Input type="time" value={editData.end_time} onChange={e => setEditData(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Miejsce / sala</Label>
              <Input value={editData.location} onChange={e => setEditData(p => ({ ...p, location: e.target.value }))} placeholder="Wrocław | Bierutowska 57-59" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Liczba uczestników</Label>
                <Input type="number" value={editData.planned_participants_count} onChange={e => setEditData(p => ({ ...p, planned_participants_count: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Koszt planowany (zł)</Label>
                <Input type="number" step="0.01" value={editData.planned_cost} onChange={e => setEditData(p => ({ ...p, planned_cost: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={editData.status} onValueChange={v => setEditData(p => ({ ...p, status: v ?? p.status }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Szkic</SelectItem>
                  <SelectItem value="planned">Zaplanowane</SelectItem>
                  <SelectItem value="completed">Zrealizowane</SelectItem>
                  <SelectItem value="settled">Rozliczone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notatki</Label>
              <Textarea rows={2} value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-600 hover:bg-red-50 mr-auto"
              onClick={() => { setEditDialog({ open: false, event: null }); handleDelete(editDialog.event!.id, editDialog.event!.name) }}
            >
              Usuń zdarzenie
            </Button>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, event: null })}>Anuluj</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete event dialog */}
      <Dialog open={completeDialog.open} onOpenChange={open => !open && setCompleteDialog({ open: false, event: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Oznacz jako zrealizowane</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">Zdarzenie: <strong>{completeDialog.event?.name}</strong></p>
            <div className="space-y-2">
              <Label>Rzeczywista liczba uczestników</Label>
              <Input type="number" value={completingData.actual_participants_count} onChange={e => setCompletingData(p => ({ ...p, actual_participants_count: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rzeczywisty koszt (zł)</Label>
              <Input type="number" step="0.01" value={completingData.actual_cost} onChange={e => setCompletingData(p => ({ ...p, actual_cost: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notatki (opcjonalne)</Label>
              <Textarea value={completingData.notes} onChange={e => setCompletingData(p => ({ ...p, notes: e.target.value }))} rows={2} />
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
      <Dialog open={settleDialog.open} onOpenChange={open => !open && setSettleDialog({ open: false, event: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wyślij zlecenie do księgowej</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">Zlecenie zostanie wysłane do Kamili do wystawienia faktury.</p>
            <div className="space-y-2">
              <Label>Kwota do zafakturowania (zł) *</Label>
              <Input type="number" step="0.01" value={settleData.amount} onChange={e => setSettleData(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Opis do faktury *</Label>
              <Textarea value={settleData.description} onChange={e => setSettleData(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Pełny opis usługi do wpisania na fakturze..." />
            </div>
            <div className="space-y-2">
              <Label>Notatka dla Kamili (opcjonalne)</Label>
              <Textarea value={settleData.notes_for_accountant} onChange={e => setSettleData(p => ({ ...p, notes_for_accountant: e.target.value }))} rows={2} placeholder="Dodatkowe instrukcje..." />
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
