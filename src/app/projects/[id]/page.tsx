import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BudgetProgress } from "@/components/budget/budget-progress"
import { SpendingMobilization } from "@/components/budget/spending-mobilization"
import { EventStatusBadge } from "@/components/events/event-status-badge"
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  daysRemaining,
  projectStatusLabel,
  eventTypeLabel,
  percentOf,
} from "@/lib/utils"
import {
  Calendar,
  Users,
  Wallet,
  TrendingUp,
  Plus,
  ArrowRight,
  CheckCircle,
  Clock,
} from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: project } = await supabase
    .from("projects")
    .select("*, organization:organizations(id,name)")
    .eq("id", id)
    .single()

  if (!project) notFound()

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, budget_lines(*)")
    .eq("project_id", id)
    .order("number", { ascending: true })

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("project_id", id)
    .order("planned_date", { ascending: false })
    .limit(5)

  const { data: participants } = await supabase
    .from("participants")
    .select("id, gender, age_at_start, degurba")
    .eq("project_id", id)

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, status, task_id")
    .eq("project_id", id)
    .in("status", ["invoiced", "paid", "settled"])

  const { data: settlementPeriods } = await supabase
    .from("settlement_periods")
    .select("*")
    .eq("project_id", id)
    .order("number", { ascending: true })

  const { data: accountingRequests } = await supabase
    .from("accounting_requests")
    .select("id")
    .eq("project_id", id)
    .eq("status", "pending")

  const { data: allPendingRequests } = await supabase
    .from("accounting_requests")
    .select("id")
    .eq("status", "pending")

  // Compute stats
  const totalParticipants = participants?.length ?? 0
  const femaleCount = participants?.filter((p) => p.gender === "K").length ?? 0
  const maleCount = participants?.filter((p) => p.gender === "M").length ?? 0
  const age55Plus = participants?.filter((p) => (p.age_at_start ?? 0) >= 55).length ?? 0
  const ruralCount = participants?.filter((p) => p.degurba === 3).length ?? 0

  const totalSpent = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const taskExpenses: Record<string, number> = {}
  expenses?.forEach((e) => {
    if (e.task_id) {
      taskExpenses[e.task_id] = (taskExpenses[e.task_id] ?? 0) + e.amount
    }
  })

  const days = daysRemaining(project.end_date)
  const budgetPercent = percentOf(totalSpent, project.total_budget ?? 0)
  const pendingCount = allPendingRequests?.length ?? 0
  const projectPendingCount = accountingRequests?.length ?? 0

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-slate-100 text-slate-700",
    suspended: "bg-amber-100 text-amber-700",
  }

  return (
    <div className="flex h-screen">
      <Sidebar pendingAccountingCount={pendingCount} />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title={project.short_name ?? project.name}
          userProfile={userProfile}
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project.short_name ?? project.name },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Project header info */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
                <Badge className={statusColors[project.status] ?? ""}>
                  {projectStatusLabel(project.status)}
                </Badge>
                {project.is_subcontractor && (
                  <Badge variant="outline">Podwykonawca</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                <span>{project.project_number}</span>
                <span>{formatDate(project.start_date)} – {formatDate(project.end_date)}</span>
                {project.organization && <span>{project.organization.name}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/projects/${id}/events/new`}>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Zdarzenie
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Budżet</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(project.total_budget)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Wydano</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
                    <p className="text-xs text-slate-400">{budgetPercent}% budżetu</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Uczestnicy</p>
                    <p className="text-lg font-bold text-slate-900">{totalParticipants}</p>
                    <p className="text-xs text-slate-400">K:{femaleCount} M:{maleCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    days < 30 ? "bg-red-50" : days < 90 ? "bg-amber-50" : "bg-slate-50"
                  }`}>
                    <Clock className={`w-5 h-5 ${
                      days < 30 ? "text-red-500" : days < 90 ? "text-amber-500" : "text-slate-500"
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pozostało dni</p>
                    <p className={`text-lg font-bold ${
                      days < 30 ? "text-red-600" : days < 90 ? "text-amber-600" : "text-slate-900"
                    }`}>{days}</p>
                    <p className="text-xs text-slate-400">do {formatDateShort(project.end_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobilization alert */}
          {project.advance_received > 0 && (
            <SpendingMobilization
              advanceReceived={project.advance_received}
              alreadySettled={totalSpent}
            />
          )}

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Przegląd</TabsTrigger>
              <TabsTrigger value="tasks">Zadania</TabsTrigger>
              <TabsTrigger value="events">Zdarzenia</TabsTrigger>
              <TabsTrigger value="participants">Uczestnicy</TabsTrigger>
              <TabsTrigger value="wnp">WNP</TabsTrigger>
            </TabsList>

            {/* Overview tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Budget per task */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Budżet wg zadań</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tasks?.length === 0 ? (
                      <p className="text-sm text-slate-500">Brak zadań</p>
                    ) : (
                      tasks?.map((task) => (
                        <BudgetProgress
                          key={task.id}
                          label={`Zad. ${task.number}: ${task.name}`}
                          planned={task.budget_total ?? task.budget_direct}
                          spent={taskExpenses[task.id] ?? 0}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Participants stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Wskaźniki uczestników</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Cele wskaźnikowe z wniosku per projekt
                      const targets: Record<string, { total: number; female: number; male: number; age55: number; rural: number }> = {
                        'FEDS.07.03-IP.02-0039/25': { total: 460, female: 408, male: 52, age55: 99, rural: 100 },
                        'FEDS.07.05-IP.02-0172/24': { total: 80, female: 48, male: 32, age55: 0, rural: 0 },
                      }
                      const t = targets[project.project_number] ?? { total: 0, female: 0, male: 0, age55: 0, rural: 0 }
                      const stats = [
                        { label: "Kobiety", value: femaleCount, target: t.female, color: "text-pink-600", warn: femaleCount >= t.female },
                        { label: "Mężczyźni", value: maleCount, target: t.male, color: "text-blue-600", warn: maleCount >= t.male },
                        { label: "Wiek 55+", value: age55Plus, target: t.age55, color: "text-amber-600", warn: age55Plus >= t.age55 },
                        { label: "Obszar wiejski", value: ruralCount, target: t.rural, color: "text-green-600", warn: ruralCount >= t.rural },
                      ]
                      return (
                        <>
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm text-slate-500">Łącznie uczestników</span>
                            <span className={`text-sm font-semibold ${totalParticipants >= t.total ? "text-green-600" : "text-slate-900"}`}>
                              {totalParticipants} / {t.total}
                              {t.total > 0 && <span className="text-xs text-slate-400 ml-1">({Math.round(totalParticipants/t.total*100)}%)</span>}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, t.total > 0 ? totalParticipants/t.total*100 : 0)}%` }} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {stats.map((stat) => (
                              <div key={stat.label} className="p-3 bg-slate-50 rounded-lg">
                                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}{stat.target > 0 && <span className="text-sm font-normal text-slate-400"> / {stat.target}</span>}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-slate-500">{stat.label}</p>
                                  {stat.target > 0 && (
                                    <span className={`text-xs font-medium ${stat.warn ? "text-green-600" : "text-amber-600"}`}>
                                      {stat.target > 0 ? `brakuje: ${Math.max(0, stat.target - stat.value)}` : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                    <div className="mt-4 text-right">
                      <Link href={`/projects/${id}/participants`} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 justify-end">
                        Wszyscy uczestnicy <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tasks tab */}
            <TabsContent value="tasks" className="mt-4">
              <div className="flex justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Zadania i linie budżetowe</h3>
                <Link href={`/projects/${id}/tasks`}>
                  <Button variant="outline" size="sm">
                    Zarządzaj zadaniami <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-3">
                {tasks?.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-slate-900">
                          Zadanie {task.number}: {task.name}
                        </h4>
                        <span className="text-sm text-slate-500">
                          {formatCurrency(task.budget_total ?? task.budget_direct)}
                        </span>
                      </div>
                      <BudgetProgress
                        planned={task.budget_total ?? task.budget_direct}
                        spent={taskExpenses[task.id] ?? 0}
                        compact
                      />
                      {task.budget_lines && task.budget_lines.length > 0 && (
                        <p className="text-xs text-slate-400 mt-2">
                          {task.budget_lines.length} pozycji budżetowych
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {(!tasks || tasks.length === 0) && (
                  <Card>
                    <CardContent className="py-8 text-center text-slate-500">
                      <p>Brak zadań.</p>
                      <Link href={`/projects/${id}/tasks`} className="text-blue-600 text-sm mt-1 inline-block">
                        Dodaj zadania →
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Events tab */}
            <TabsContent value="events" className="mt-4">
              <div className="flex justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Ostatnie zdarzenia</h3>
                <div className="flex gap-2">
                  <Link href={`/projects/${id}/events/new`}>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Nowe zdarzenie
                    </Button>
                  </Link>
                  <Link href={`/projects/${id}/events`}>
                    <Button variant="outline" size="sm">
                      Wszystkie <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                {events?.map((event) => (
                  <Card key={event.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{event.name}</p>
                        <p className="text-sm text-slate-500">
                          {eventTypeLabel(event.type)} · {formatDateShort(event.planned_date)}
                          {event.location && ` · ${event.location}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">
                          {event.actual_participants_count ?? event.planned_participants_count} os.
                        </span>
                        <EventStatusBadge status={event.status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!events || events.length === 0) && (
                  <Card>
                    <CardContent className="py-8 text-center text-slate-500">
                      <p>Brak zdarzeń.</p>
                      <Link href={`/projects/${id}/events/new`} className="text-blue-600 text-sm mt-1 inline-block">
                        Dodaj pierwsze zdarzenie →
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Participants tab */}
            <TabsContent value="participants" className="mt-4">
              <div className="flex justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Uczestnicy projektu</h3>
                <Link href={`/projects/${id}/participants`}>
                  <Button variant="outline" size="sm">
                    Zarządzaj uczestnikami <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Łącznie", value: totalParticipants, color: "bg-blue-50 text-blue-700" },
                  { label: "Kobiety (K)", value: femaleCount, color: "bg-pink-50 text-pink-700" },
                  { label: "Mężczyźni (M)", value: maleCount, color: "bg-indigo-50 text-indigo-700" },
                  { label: "55+ lat", value: age55Plus, color: "bg-amber-50 text-amber-700" },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className={`p-4 text-center ${stat.color} rounded-lg`}>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-sm mt-1">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* WNP tab */}
            <TabsContent value="wnp" className="mt-4">
              <div className="flex justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Wnioski o płatność</h3>
                <Link href={`/projects/${id}/wnp`}>
                  <Button variant="outline" size="sm">
                    Zarządzaj WNP <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              {settlementPeriods && settlementPeriods.length > 0 ? (
                <div className="space-y-3">
                  {settlementPeriods.map((period) => {
                    const statusColors: Record<string, string> = {
                      draft: "bg-slate-100 text-slate-600",
                      submitted: "bg-blue-100 text-blue-700",
                      approved: "bg-green-100 text-green-700",
                      rejected: "bg-red-100 text-red-700",
                    }
                    const statusLabels: Record<string, string> = {
                      draft: "Szkic",
                      submitted: "Złożony",
                      approved: "Zatwierdzony",
                      rejected: "Odrzucony",
                    }
                    return (
                      <Card key={period.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle className={`w-5 h-5 ${period.status === "approved" ? "text-green-500" : "text-slate-300"}`} />
                              <div>
                                <p className="font-semibold text-slate-900">WNP{String(period.number).padStart(3, "0")}</p>
                                <p className="text-sm text-slate-500">{formatDate(period.period_start)} – {formatDate(period.period_end)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">{formatCurrency(period.total_claimed)}</p>
                                <p className="text-xs text-slate-400">rozliczone</p>
                              </div>
                              {period.advance_received && (
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-blue-700">{formatCurrency(period.advance_amount)}</p>
                                  <p className="text-xs text-slate-400">zaliczka</p>
                                </div>
                              )}
                              <Badge className={statusColors[period.status] ?? ""}>{statusLabels[period.status] ?? period.status}</Badge>
                            </div>
                          </div>
                          {period.notes && <p className="text-xs text-slate-400 mt-2 ml-8">{period.notes}</p>}
                        </CardContent>
                      </Card>
                    )
                  })}
                  {/* Suma */}
                  <Card className="bg-slate-50">
                    <CardContent className="p-4 flex justify-between items-center">
                      <span className="font-semibold text-slate-700">Łącznie rozliczone</span>
                      <span className="font-bold text-slate-900 text-lg">
                        {formatCurrency(settlementPeriods.reduce((s, p) => s + (p.total_claimed ?? 0), 0))}
                      </span>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-slate-500">
                    <p>Brak okresów rozliczeniowych.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
