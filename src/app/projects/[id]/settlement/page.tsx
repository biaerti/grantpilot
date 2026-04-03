"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft, Loader2, FileCheck, Calendar, Users, Clock } from "lucide-react"
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
  task?: { number: number; name: string } | null
  contract?: { id: string; name: string; contractor?: { name: string } | null } | null
  event_participants?: { count: number }[]
}

const MONTHS = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"]

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

  const currentYear = new Date().getFullYear()
  const monthOptions = []
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
        planned_participants_count, status, location, executor_name, contract_id,
        task:tasks(number, name),
        contract:contracts(id, name, contractor:contractors(name)),
        event_participants(count)
      `)
      .eq("project_id", projectId)
      .order("planned_date", { ascending: true })
    setEvents((data ?? []) as unknown as EventItem[])
    setLoading(false)
  }

  // Filter events by selected month
  const [selYear, selMonthNum] = selectedMonth.split("-").map(Number)
  const filteredByMonth = events.filter(ev => {
    if (!ev.planned_date) return false
    const d = new Date(ev.planned_date)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonthNum
  })

  // Unique contracts in filtered events
  const contractsInMonth = [...new Map(
    filteredByMonth
      .filter(ev => ev.contract)
      .map(ev => [ev.contract!.id, ev.contract!])
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

  const generateProtocol = () => {
    const [y, m] = selectedMonth.split("-").map(Number)
    const monthName = MONTHS[m - 1]
    const contractName = filterContract !== "all"
      ? filteredEvents[0]?.contract?.name ?? "—"
      : "Wszystkie umowy"
    const contractorName = filterContract !== "all"
      ? filteredEvents[0]?.contract?.contractor?.name ?? "—"
      : "—"

    const rows = filteredEvents.map(ev =>
      `${formatDate(ev.planned_date ?? "")} | ${ev.name} | ${ev.planned_hours ?? "—"}h | ${ev.planned_participants_count ?? "—"} os.`
    ).join("\n")

    const protocol = `PROTOKÓŁ ODBIORU USŁUG
Miesiąc: ${monthName} ${y}
Umowa: ${contractName}
Wykonawca: ${contractorName}

Zrealizowane usługi:
${"─".repeat(60)}
${rows}
${"─".repeat(60)}
Łącznie godzin: ${totalHours}h
Łącznie uczestników: ${totalParticipants} os.
Łączna wartość: ${formatCurrency(totalCost)}

Odbiorca (data i podpis): ________________________________

Wykonawca (data i podpis): ________________________________`

    const blob = new Blob([protocol], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `protokol_odbioru_${selectedMonth}_${contractorName.replace(/\s/g, "_")}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Protokół wygenerowany!")
  }

  const unsettledIds = filteredEvents.filter(ev => ev.status !== "settled").map(ev => ev.id)

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    planned: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    completed: "bg-emerald-100 text-emerald-700",
    settled: "bg-purple-100 text-purple-700",
  }
  const statusLabels: Record<string, string> = {
    draft: "Szkic", planned: "Zaplanowane", accepted: "Zatwierdzone",
    completed: "Zakończone", settled: "Rozliczone",
  }

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
              <Button
                variant="outline"
                onClick={generateProtocol}
                className="gap-1"
              >
                <FileCheck className="w-4 h-4" />
                Generuj protokół odbioru
              </Button>
              {unsettledIds.length > 0 && (
                <Button
                  onClick={() => handleSettle(unsettledIds)}
                  disabled={settling}
                  className="gap-1"
                >
                  {settling ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                  Rozlicz wszystkie ({unsettledIds.length})
                </Button>
              )}
            </div>
          )}

          {/* Events list */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p>Brak zdarzeń w wybranym miesiącu.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map(ev => (
                <Card key={ev.id} className={ev.status === "settled" ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{ev.name}</p>
                          <Badge className={`text-xs ${statusColors[ev.status] ?? "bg-slate-100"}`}>
                            {statusLabels[ev.status] ?? ev.status}
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleSettle([ev.id])}
                          disabled={settling}
                        >
                          Rozlicz
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
