import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SpendingMobilization } from "@/components/budget/spending-mobilization"
import { formatCurrency, formatDate, formatDateShort, daysRemaining, getProjectHexColor, eventTypeLabel, percentOf } from "@/lib/utils"
import { EventStatusBadge } from "@/components/events/event-status-badge"
import Link from "next/link"
import {
  FolderKanban,
  Users,
  CalendarDays,
  Receipt,
  Clock,
  TrendingUp,
  ArrowRight,
  AlertCircle,
} from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })

  const { data: accountingRequests } = await supabase
    .from("accounting_requests")
    .select("*, project:projects(id,short_name,name), event:events(id,name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: upcomingEvents } = await supabase
    .from("events")
    .select("*, project:projects(id,short_name,name,status)")
    .in("status", ["planned", "accepted"])
    .gte("planned_date", new Date().toISOString().split("T")[0])
    .order("planned_date", { ascending: true })
    .limit(8)

  const { data: participantCounts } = await supabase
    .from("participants")
    .select("project_id, gender")

  const projectParticipants: Record<string, { total: number; K: number; M: number }> = {}
  participantCounts?.forEach((p) => {
    if (!projectParticipants[p.project_id]) {
      projectParticipants[p.project_id] = { total: 0, K: 0, M: 0 }
    }
    projectParticipants[p.project_id].total++
    if (p.gender === "K") projectParticipants[p.project_id].K++
    if (p.gender === "M") projectParticipants[p.project_id].M++
  })

  const { data: expenses } = await supabase
    .from("expenses")
    .select("project_id, amount, status")
    .in("status", ["invoiced", "paid", "settled"])

  const projectExpenses: Record<string, number> = {}
  expenses?.forEach((e) => {
    projectExpenses[e.project_id] = (projectExpenses[e.project_id] ?? 0) + e.amount
  })

  const totalProjects = projects?.length ?? 0
  const totalParticipants = participantCounts?.length ?? 0
  const pendingCount = accountingRequests?.length ?? 0
  const upcomingCount = upcomingEvents?.length ?? 0

  return (
    <div className="flex h-screen">
      <Sidebar pendingAccountingCount={pendingCount} />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Dashboard"
          userProfile={userProfile}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Aktywne projekty</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{totalProjects}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FolderKanban className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Uczestnicy łącznie</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{totalParticipants}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Nadchodzące zdarzenia</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{upcomingCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                    <CalendarDays className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Do rozliczenia</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{pendingCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Aktywne projekty</h2>
                <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  Wszystkie <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {projects?.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-slate-500">
                    <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Brak aktywnych projektów</p>
                    <Link href="/projects/new" className="text-blue-600 text-sm mt-1 inline-block">
                      Utwórz pierwszy projekt →
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                projects?.map((project, idx) => {
                  const participants = projectParticipants[project.id] ?? { total: 0, K: 0, M: 0 }
                  const spent = projectExpenses[project.id] ?? 0
                  const days = daysRemaining(project.end_date)
                  const color = getProjectHexColor(idx)
                  const startMs = new Date(project.start_date).getTime()
                  const endMs = new Date(project.end_date).getTime()
                  const nowMs = Date.now()
                  const timeElapsedPct = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)))
                  const budgetPct = percentOf(spent, project.total_budget ?? 0)

                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                                style={{ backgroundColor: color }}
                              />
                              <div>
                                <h3 className="font-semibold text-slate-900">
                                  {project.short_name ?? project.name}
                                </h3>
                                <p className="text-xs text-slate-500">{project.project_number}</p>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <span className={`font-medium ${days < 30 ? "text-red-600" : days < 90 ? "text-amber-600" : "text-slate-600"}`}>
                                {days > 0 ? `${days} dni` : "Zakończony"}
                              </span>
                              <p className="text-xs text-slate-400">do końca</p>
                            </div>
                          </div>

                          {/* Dual progress: time elapsed vs budget spent */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                              <span>Czas</span>
                              <span>{timeElapsedPct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${timeElapsedPct >= 90 ? "bg-red-500" : timeElapsedPct >= 70 ? "bg-amber-500" : "bg-slate-400"}`}
                                style={{ width: `${timeElapsedPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1 mb-0.5">
                              <span>Budżet</span>
                              <span>{budgetPct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-red-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-blue-500"}`}
                                style={{ width: `${budgetPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                              <span>Wydano: {formatCurrency(spent)}</span>
                              <span>Pozostało: {formatCurrency((project.total_budget ?? 0) - spent)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              K: {participants.K} / M: {participants.M}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              do {formatDateShort(project.end_date)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Pending accounting requests */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Zlecenia dla Kamili</CardTitle>
                    <Link href="/accounting" className="text-xs text-blue-600 hover:text-blue-700">
                      Wszystkie
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accountingRequests?.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-3">Brak oczekujących zleceń</p>
                  ) : (
                    accountingRequests?.map((req) => (
                      <div key={req.id} className="flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {req.event?.name ?? req.description.slice(0, 40)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {req.project?.short_name ?? req.project?.name}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(req.amount)}</p>
                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
                            Oczekuje
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Upcoming events */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Ten tydzień</CardTitle>
                    <Link href="/calendar" className="text-xs text-blue-600 hover:text-blue-700">
                      Kalendarz
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcomingEvents?.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-3">Brak nadchodzących zdarzeń</p>
                  ) : (
                    upcomingEvents?.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{event.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatDateShort(event.planned_date)} · {eventTypeLabel(event.type)}
                          </p>
                        </div>
                        <EventStatusBadge status={event.status} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mobilization section */}
          {projects && projects.filter(p => p.advance_received > 0).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">
                <TrendingUp className="w-5 h-5 inline mr-2 text-blue-500" />
                Mobilizacja wydatków
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects
                  .filter((p) => p.advance_received > 0)
                  .map((project) => {
                    const settled = projectExpenses[project.id] ?? 0
                    return (
                      <SpendingMobilization
                        key={project.id}
                        advanceReceived={project.advance_received}
                        alreadySettled={settled}
                        projectName={project.short_name ?? project.name}
                      />
                    )
                  })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
