"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft, Loader2, FileCheck, Calendar, Users, Clock, List, CalendarDays } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"

interface EventItem {
  id: string
  name: string
  planned_date?: string | null
  planned_end_date?: string | null
  planned_hours?: number | null
  planned_cost?: number | null
  planned_participants_count?: number | null
  status: string
  location?: string | null
  executor_name?: string | null
  contract_id?: string | null
  task_id?: string | null
  task?: { id: string; number: number; name: string } | null
  contract?: { id: string; name: string; contractor_id?: string | null; contractor?: { name: string } | null } | null
  event_participants?: { count: number }[]
}

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"]
const DAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  planned: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  completed: "bg-emerald-100 text-emerald-700",
  settled: "bg-purple-100 text-purple-700",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic", planned: "Zaplanowane", accepted: "Zatwierdzone",
  completed: "Zakończone", settled: "Rozliczone",
}
const STATUS_DOT: Record<string, string> = {
  draft: "bg-slate-400", planned: "bg-blue-500", accepted: "bg-green-500",
  completed: "bg-emerald-500", settled: "bg-purple-500",
}

// Build calendar grid for a given YYYY-MM
function buildCalendarGrid(year: number, month: number) {
  // month is 1-based
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  // Mon=0 ... Sun=6
  const startDow = (firstDay.getDay() + 6) % 7 // 0=Mon
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function SettlementPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [filterContract, setFilterContract] = useState("all")
  const [settling, setSettling] = useState(false)
  const [generatingProtocols, setGeneratingProtocols] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")

  const monthOptions: string[] = []
  for (let y = 2025; y <= 2027; y++) {
    for (let m = 1; m <= 12; m++) {
      monthOptions.push(`${y}-${String(m).padStart(2, "0")}`)
    }
  }

  useEffect(() => { fetchEvents() }, [projectId])

  async function fetchEvents() {
    const { data } = await supabase
      .from("events")
      .select(`
        id, name, planned_date, planned_end_date, planned_hours, planned_cost,
        planned_participants_count, status, location, executor_name, contract_id, task_id,
        task:tasks(id, number, name),
        contract:contracts(id, name, contractor_id, contractor:contractors(name)),
        event_participants(count)
      `)
      .eq("project_id", projectId)
      .order("planned_date", { ascending: true })
    setEvents((data ?? []) as unknown as EventItem[])
    setLoading(false)
  }

  const [selYear, selMonthNum] = selectedMonth.split("-").map(Number)

  const filteredByMonth = events.filter(ev => {
    if (!ev.planned_date) return false
    const d = new Date(ev.planned_date)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonthNum
  })

  const contractsInMonth = [...new Map(
    filteredByMonth.filter(ev => ev.contract).map(ev => [ev.contract!.id, ev.contract!])
  ).values()]

  const filteredEvents = filterContract === "all"
    ? filteredByMonth
    : filteredByMonth.filter(ev => ev.contract_id === filterContract)

  const totalHours = filteredEvents.reduce((s, ev) => s + (ev.planned_hours ?? 0), 0)
  const totalCost = filteredEvents.reduce((s, ev) => s + (ev.planned_cost ?? 0), 0)
  const totalParticipants = filteredEvents.reduce((s, ev) => s + (ev.planned_participants_count ?? 0), 0)

  const handleSettle = async (eventIds: string[]) => {
    if (!confirm(`Oznaczyć ${eventIds.length} zdarzeń jako rozliczone?`)) return
    setSettling(true)
    const { error } = await supabase
      .from("events")
      .update({ status: "settled", settled_at: new Date().toISOString() })
      .in("id", eventIds)
    setSettling(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setEvents(prev => prev.map(ev => eventIds.includes(ev.id) ? { ...ev, status: "settled" } : ev))
    toast.success("Zdarzenia rozliczone!")
  }

  const generateProtocols = async () => {
    if (!confirm("Wygenerować protokoły odbioru dla wybranych zdarzeń?")) return
    setGeneratingProtocols(true)

    const { data: tmplData } = await supabase
      .from("document_types")
      .select("id")
      .eq("project_id", projectId)
      .eq("category", "protokol")
      .limit(1)
      .single()
    const templateId = tmplData?.id ?? null

    const groups = new Map<string, EventItem[]>()
    for (const ev of filteredEvents) {
      const key = `${ev.contract_id ?? "none"}|${ev.task_id ?? "none"}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(ev)
    }

    let successCount = 0
    let failCount = 0

    for (const [, groupEvents] of groups) {
      const first = groupEvents[0]
      try {
        const res = await fetch("/api/generate-protocol", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            contract_id: first.contract_id ?? null,
            contractor_id: first.contract?.contractor_id ?? null,
            task_id: first.task_id ?? null,
            month: selectedMonth,
            event_ids: groupEvents.map(ev => ev.id),
            template_id: templateId,
          }),
        })
        const json = await res.json()
        if (!res.ok) { console.error("generate-protocol error:", json.error); failCount++ }
        else successCount++
      } catch (err) { console.error("generate-protocol fetch error:", err); failCount++ }
    }

    setGeneratingProtocols(false)
    if (successCount > 0) {
      toast.success(
        `Wygenerowano ${successCount} protokół${successCount === 1 ? "" : successCount < 5 ? "e" : "ów"}!`,
        { action: { label: "Zobacz protokoły →", onClick: () => { window.location.href = `/projects/${projectId}/protocols` } }, duration: 8000 }
      )
    }
    if (failCount > 0) toast.error(`${failCount} protokołów nie udało się wygenerować.`)
  }

  const unsettledIds = filteredEvents.filter(ev => ev.status !== "settled").map(ev => ev.id)

  // Calendar helpers
  const calendarCells = buildCalendarGrid(selYear, selMonthNum)
  const eventsByDay: Record<number, EventItem[]> = {}
  for (const ev of filteredEvents) {
    if (!ev.planned_date) continue
    const d = new Date(ev.planned_date).getDate()
    if (!eventsByDay[d]) eventsByDay[d] = []
    eventsByDay[d].push(ev)
  }
  const today = new Date()

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Rozliczenie zdarzeń"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Rozliczenie" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" />
              Wróć do projektu
            </Link>
            {/* Lista / Kalendarz toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <List className="w-4 h-4" />Lista
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "calendar" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <CalendarDays className="w-4 h-4" />Kalendarz
              </button>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Miesiąc</p>
                <Select value={selectedMonth} onValueChange={v => setSelectedMonth(v ?? "")}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => {
                      const [y, m] = opt.split("-").map(Number)
                      return <SelectItem key={opt} value={opt}>{MONTHS[m - 1]} {y}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Umowa / Wykonawca</p>
                <Select value={filterContract} onValueChange={v => setFilterContract(v ?? "all")}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie</SelectItem>
                    {contractsInMonth.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.contractor ? ` · ${c.contractor.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {filteredEvents.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Zdarzenia", value: filteredEvents.length, icon: Calendar },
                { label: "Godzin łącznie", value: `${totalHours}h`, icon: Clock },
                { label: "Uczestników", value: totalParticipants, icon: Users },
                { label: "Wartość", value: formatCurrency(totalCost), icon: FileCheck },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Icon className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-bold text-slate-900">{value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {filteredEvents.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={generateProtocols} disabled={generatingProtocols} className="gap-1">
                {generatingProtocols ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                Generuj protokoły odbioru
              </Button>
              {unsettledIds.length > 0 && (
                <Button onClick={() => handleSettle(unsettledIds)} disabled={settling} className="gap-1">
                  {settling ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                  Rozlicz wszystkie ({unsettledIds.length})
                </Button>
              )}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
          ) : filteredEvents.length === 0 && viewMode === "list" ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p>Brak zdarzeń w wybranym miesiącu.</p>
              </CardContent>
            </Card>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {filteredEvents.map(ev => (
                <Card key={ev.id} className={ev.status === "settled" ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{ev.name}</p>
                          <Badge className={`text-xs ${STATUS_COLORS[ev.status] ?? "bg-slate-100"}`}>
                            {STATUS_LABELS[ev.status] ?? ev.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                          {ev.planned_date && <span>{formatDate(ev.planned_date)}{ev.planned_end_date && ev.planned_end_date !== ev.planned_date ? ` – ${formatDate(ev.planned_end_date)}` : ""}</span>}
                          {ev.task && <span>Zad. {ev.task.number}</span>}
                          {ev.planned_hours && <span>{ev.planned_hours}h</span>}
                          {ev.planned_participants_count && <span>{ev.planned_participants_count} os.</span>}
                          {ev.planned_cost ? <span className="text-green-700 font-medium">{formatCurrency(ev.planned_cost)}</span> : null}
                          {ev.location && <span>{ev.location}</span>}
                        </div>
                        {ev.contract && (
                          <p className="text-xs text-slate-400 mt-1">
                            Umowa: {ev.contract.name}{ev.contract.contractor ? ` · ${ev.contract.contractor.name}` : ""}
                          </p>
                        )}
                        {ev.executor_name && !ev.contract && (
                          <p className="text-xs text-slate-400 mt-1">Wykonawca: {ev.executor_name}</p>
                        )}
                      </div>
                      {ev.status !== "settled" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSettle([ev.id])} disabled={settling}>
                          Rozlicz
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* ── Widok kalendarza ── */
            <Card>
              <CardContent className="p-0">
                {/* Header with month navigation */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <button
                    className="p-1 rounded hover:bg-slate-100 transition-colors"
                    onClick={() => {
                      const [y, m] = selectedMonth.split("-").map(Number)
                      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
                      setSelectedMonth(prev)
                    }}
                  >
                    ‹
                  </button>
                  <p className="font-semibold text-slate-800">{MONTHS[selMonthNum - 1]} {selYear}</p>
                  <button
                    className="p-1 rounded hover:bg-slate-100 transition-colors"
                    onClick={() => {
                      const [y, m] = selectedMonth.split("-").map(Number)
                      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
                      setSelectedMonth(next)
                    }}
                  >
                    ›
                  </button>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b">
                  {DAYS_PL.map(d => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>
                  ))}
                </div>
                {/* Calendar cells */}
                <div className="grid grid-cols-7">
                  {calendarCells.map((day, i) => {
                    const isToday = day !== null
                      && today.getFullYear() === selYear
                      && today.getMonth() + 1 === selMonthNum
                      && today.getDate() === day
                    const dayEvents = day !== null ? (eventsByDay[day] ?? []) : []
                    return (
                      <div
                        key={i}
                        className={`min-h-20 border-b border-r p-1 ${day === null ? "bg-slate-50" : ""} ${i % 7 === 6 ? "border-r-0" : ""}`}
                      >
                        {day !== null && (
                          <>
                            <p className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                              isToday ? "bg-blue-600 text-white" : "text-slate-600"
                            }`}>
                              {day}
                            </p>
                            <div className="space-y-0.5">
                              {dayEvents.map(ev => (
                                <div
                                  key={ev.id}
                                  className="flex items-center gap-1 px-1 py-0.5 rounded text-xs bg-slate-50 hover:bg-slate-100 transition-colors cursor-default"
                                  title={`${ev.name}${ev.planned_hours ? ` · ${ev.planned_hours}h` : ""}${ev.contract?.contractor ? ` · ${ev.contract.contractor.name}` : ""}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[ev.status] ?? "bg-slate-400"}`} />
                                  <span className="truncate text-slate-700 leading-tight">{ev.name}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 px-4 py-2 border-t text-xs text-slate-500">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[k]}`} />{v}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
