"use client"

import { useState, useEffect } from "react"
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
import { ChevronLeft, ChevronRight, Users, Wallet, MapPin } from "lucide-react"
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

interface EventWithProject extends Event {
  project: Project
}

export default function CalendarPage() {
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<EventWithProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventWithProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [eventsRes, projectsRes] = await Promise.all([
      supabase
        .from("events")
        .select("*, project:projects(*)")
        .not("planned_date", "is", null)
        .order("planned_date", { ascending: true }),
      supabase.from("projects").select("*").order("name"),
    ])
    setEvents(eventsRes.data ?? [])
    setProjects(projectsRes.data ?? [])
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
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - project legend */}
            <div className="w-56 flex-shrink-0 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Projekty</h3>
                <div className="space-y-2">
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
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-slate-700 flex-1 truncate">
                          {p.short_name ?? p.name}
                        </span>
                        <span className="text-xs text-slate-400">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Upcoming events */}
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
