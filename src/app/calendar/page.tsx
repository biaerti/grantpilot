"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EventStatusBadge } from "@/components/events/event-status-badge"
import { formatCurrency, eventTypeLabel, formatDate, getProjectHexColor } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Users, Wallet, MapPin, Bell, Phone, CheckSquare, Clock } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns"
import { pl } from "date-fns/locale"
import type { Event, Project } from "@/lib/types"
import Link from "next/link"

interface EventWithProject extends Event {
  project: Project
}

interface ReminderWithJoin {
  id: string
  project_id: string
  remind_at: string
  all_day: boolean
  note?: string | null
  assigned_to: string
  done: boolean
  participant: { id: string; first_name: string; last_name: string; phone?: string | null } | null
  project: { id: string; short_name?: string | null; name: string } | null
}

function CalendarPageInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<EventWithProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventWithProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set())
  const [reminders, setReminders] = useState<ReminderWithJoin[]>([])
  const [showReminders, setShowReminders] = useState(true)
  const [reminderUser, setReminderUser] = useState<string>("") // filtr po inicjałach
  const [currentUser, setCurrentUser] = useState<string>("")  // inicjały zalogowanego

  useEffect(() => {
    fetchData()
  }, [])

  // When projects load, if ?project_id= is set, hide all others
  useEffect(() => {
    const pid = searchParams?.get("project_id")
    if (pid && projects.length > 0) {
      const toHide = new Set(projects.map(p => p.id).filter(id => id !== pid))
      setHiddenProjects(toHide)
    }
  }, [projects, searchParams])

  async function fetchData() {
    // Pobierz inicjały zalogowanego usera z profilu
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()
      if (profile?.full_name) {
        const initials = profile.full_name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
        setCurrentUser(initials)
        setReminderUser(initials)
      }
    }

    const [eventsRes, projectsRes, remindersRes] = await Promise.all([
      supabase
        .from("events")
        .select("*, project:projects(*)")
        .not("planned_date", "is", null)
        .order("planned_date", { ascending: true }),
      supabase.from("projects").select("*").order("name"),
      supabase
        .from("reminders")
        .select("*, participant:participants(id,first_name,last_name,phone), project:projects(id,name,short_name)")
        .eq("done", false)
        .order("remind_at", { ascending: true }),
    ])
    setEvents(eventsRes.data ?? [])
    setProjects(projectsRes.data ?? [])
    setReminders((remindersRes.data ?? []) as unknown as ReminderWithJoin[])
    setLoading(false)
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((e) => {
      if (!e.planned_date) return false
      if (hiddenProjects.has(e.project_id)) return false
      return isSameDay(parseISO(e.planned_date), date)
    })
  }

  const filteredReminders = reminderUser
    ? reminders.filter(r => r.assigned_to === reminderUser)
    : reminders

  const getRemindersForDay = (date: Date) => {
    if (!showReminders) return []
    return filteredReminders.filter(r => isSameDay(parseISO(r.remind_at), date))
  }

  const uniqueReminderUsers = Array.from(new Set(reminders.map(r => r.assigned_to).filter(Boolean)))

  async function markReminderDone(id: string) {
    await supabase.from("reminders").update({ done: true, done_at: new Date().toISOString() }).eq("id", id)
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  const projectColorMap: Record<string, string> = {}
  projects.forEach((p, idx) => {
    projectColorMap[p.id] = getProjectHexColor(idx)
  })

  const toggleProject = (projectId: string) => {
    setHiddenProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const weekDays = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"]

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header title="Kalendarz zdarzeń" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6">
            {/* Calendar */}
            <div className="flex-1">
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">
                  {format(currentDate, "LLLL yyyy", { locale: pl })}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Dziś
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 border-b border-slate-200">
                    {weekDays.map((wd) => (
                      <div key={wd} className="text-center text-xs font-semibold text-slate-500 py-2.5">
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7">
                    {days.map((d, i) => {
                      const dayEvents = getEventsForDay(d)
                      const dayReminders = getRemindersForDay(d)
                      const isToday = isSameDay(d, new Date())
                      const isCurrentMonth = isSameMonth(d, currentDate)
                      const isLastRow = i >= days.length - 7

                      return (
                        <div
                          key={d.toISOString()}
                          className={`min-h-24 p-1.5 border-b border-r border-slate-100 ${
                            !isCurrentMonth ? "bg-slate-50" : ""
                          } ${isLastRow ? "border-b-0" : ""} ${i % 7 === 6 ? "border-r-0" : ""}`}
                        >
                          <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? "bg-blue-600 text-white"
                              : isCurrentMonth
                              ? "text-slate-900"
                              : "text-slate-400"
                          }`}>
                            {format(d, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className="text-xs px-1.5 py-0.5 rounded cursor-pointer truncate font-medium hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: projectColorMap[event.project_id] + "20",
                                  color: projectColorMap[event.project_id],
                                  borderLeft: `3px solid ${projectColorMap[event.project_id]}`,
                                }}
                                onClick={() => setSelectedEvent(event)}
                              >
                                {event.start_time && (
                                  <span className="mr-1 opacity-70">{event.start_time.slice(0, 5)}</span>
                                )}
                                {event.name}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-xs text-slate-400 px-1.5">
                                +{dayEvents.length - 3} więcej
                              </div>
                            )}
                            {/* Przypomnienia obdzwonki */}
                            {dayReminders.map(rem => (
                              <Link
                                key={rem.id}
                                href={`/projects/${rem.project_id}/leads`}
                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded truncate bg-amber-50 text-amber-700 border-l-2 border-amber-400 hover:bg-amber-100 transition-colors"
                                title={rem.note ?? `Obdzwonka: ${rem.participant?.first_name} ${rem.participant?.last_name}`}
                              >
                                <Bell className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">
                                  {!rem.all_day && (
                                    <span className="mr-1 opacity-70">
                                      {new Date(rem.remind_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                  {rem.participant?.first_name} {rem.participant?.last_name?.[0]}.
                                  {rem.assigned_to && <span className="ml-1 opacity-60">{rem.assigned_to}</span>}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - project legend + reminders */}
            <div className="w-64 flex-shrink-0 space-y-5 overflow-y-auto max-h-full">

              {/* Projekty */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Projekty</h3>
                <div className="space-y-1">
                  {projects.map((p, idx) => {
                    const color = getProjectHexColor(idx)
                    const isHidden = hiddenProjects.has(p.id)
                    const count = events.filter((e) => e.project_id === p.id).length
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleProject(p.id)}
                        className={`w-full flex items-center gap-2 text-left p-2 rounded-lg transition-colors ${
                          isHidden ? "opacity-40" : "hover:bg-slate-100"
                        }`}
                      >
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-700 flex-1 truncate">{p.short_name ?? p.name}</span>
                        <span className="text-xs text-slate-400">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Najbliższe zdarzenia */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Najbliższe zdarzenia</h3>
                <div className="space-y-2">
                  {events
                    .filter((e) => e.planned_date && new Date(e.planned_date) >= new Date() && !hiddenProjects.has(e.project_id))
                    .slice(0, 5)
                    .map((event) => (
                      <div
                        key={event.id}
                        className="p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <p className="text-xs font-medium text-slate-900 truncate">{event.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {event.planned_date && format(parseISO(event.planned_date), "d MMM", { locale: pl })}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Przypomnienia obdzwonki */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowReminders(p => !p)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    Przypomnienia
                    {filteredReminders.length > 0 && (
                      <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        {filteredReminders.length}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 ml-1">{showReminders ? "▲" : "▼"}</span>
                  </button>
                </div>

                {showReminders && (
                  <>
                    {/* Filtr użytkownika */}
                    <div className="flex gap-1 mb-2 flex-wrap">
                      <button
                        onClick={() => setReminderUser("")}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          reminderUser === "" ? "bg-slate-700 text-white border-slate-700" : "text-slate-500 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        Wszyscy
                      </button>
                      {uniqueReminderUsers.map(u => (
                        <button
                          key={u}
                          onClick={() => setReminderUser(u === reminderUser ? "" : u)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors font-mono ${
                            reminderUser === u ? "bg-amber-500 text-white border-amber-500" : "text-slate-600 border-slate-200 hover:border-amber-300"
                          }`}
                        >
                          {u}
                          {u === currentUser && <span className="ml-1 opacity-70">(ja)</span>}
                        </button>
                      ))}
                    </div>

                    {/* Lista przypomnień */}
                    {filteredReminders.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">Brak przypomnień</p>
                    ) : (
                      <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {filteredReminders.map(rem => {
                          const remDate = new Date(rem.remind_at)
                          const isOverdue = remDate < new Date() && !isSameDay(remDate, new Date())
                          const isToday = isSameDay(remDate, new Date())
                          return (
                            <div
                              key={rem.id}
                              className={`p-2 rounded-lg border text-xs ${
                                isOverdue ? "bg-red-50 border-red-200" :
                                isToday ? "bg-amber-50 border-amber-200" :
                                "bg-white border-slate-200"
                              }`}
                            >
                              <div className="flex items-start gap-1.5">
                                <Clock className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isOverdue ? "text-red-500" : isToday ? "text-amber-500" : "text-slate-400"}`} />
                                <div className="flex-1 min-w-0">
                                  <Link
                                    href={`/projects/${rem.project_id}/leads`}
                                    className="font-medium text-slate-800 hover:text-blue-600 block truncate"
                                  >
                                    {rem.participant?.first_name} {rem.participant?.last_name}
                                  </Link>
                                  <div className="text-slate-500 mt-0.5">
                                    {rem.all_day
                                      ? format(remDate, "d MMM", { locale: pl })
                                      : format(remDate, "d MMM HH:mm", { locale: pl })
                                    }
                                    <span className="ml-1.5 font-mono text-slate-400">{rem.assigned_to}</span>
                                  </div>
                                  {rem.note && <p className="text-slate-500 mt-0.5 truncate">{rem.note}</p>}
                                  {rem.participant?.phone && (
                                    <a href={`tel:${rem.participant.phone}`} className="text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5">
                                      <Phone className="w-2.5 h-2.5" />{rem.participant.phone}
                                    </a>
                                  )}
                                </div>
                                <button
                                  onClick={() => markReminderDone(rem.id)}
                                  title="Oznacz jako wykonane"
                                  className="flex-shrink-0 text-slate-300 hover:text-green-500 transition-colors"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.name}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <EventStatusBadge status={selectedEvent.status} />
                <Badge variant="outline">{eventTypeLabel(selectedEvent.type)}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Projekt</p>
                  <p className="font-medium">
                    {selectedEvent.project?.short_name ?? selectedEvent.project?.name}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Data</p>
                  <p className="font-medium">
                    {selectedEvent.planned_date && formatDate(selectedEvent.planned_date)}
                    {selectedEvent.start_time && ` ${selectedEvent.start_time.slice(0, 5)}`}
                    {selectedEvent.end_time && `–${selectedEvent.end_time.slice(0, 5)}`}
                  </p>
                </div>
                {selectedEvent.location && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs">Miejsce</p>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedEvent.location}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs">Uczestnicy</p>
                  <p className="font-medium flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {selectedEvent.actual_participants_count ?? selectedEvent.planned_participants_count} os.
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Koszt</p>
                  <p className="font-medium flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" />
                    {formatCurrency(selectedEvent.actual_cost ?? selectedEvent.planned_cost)}
                  </p>
                </div>
              </div>

              {selectedEvent.notes && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Notatki</p>
                  <p className="text-sm text-slate-700">{selectedEvent.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarPageInner />
    </Suspense>
  )
}
