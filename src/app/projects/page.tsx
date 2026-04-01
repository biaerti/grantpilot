import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BudgetProgress } from "@/components/budget/budget-progress"
import { formatCurrency, formatDateShort, daysRemaining, projectStatusLabel, getProjectHexColor, percentOf } from "@/lib/utils"
import { Plus, FolderKanban, Users, Calendar } from "lucide-react"

export default async function ProjectsPage() {
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
    .select("*, organization:organizations(id,name)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })

  const { data: accountingRequests } = await supabase
    .from("accounting_requests")
    .select("id")
    .eq("status", "pending")

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

  const pendingCount = accountingRequests?.length ?? 0
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
          title="Projekty"
          userProfile={userProfile}
          breadcrumbs={[{ label: "Projekty" }]}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-slate-600">
              {projects?.length ?? 0} projektów w systemie
            </p>
            <Link href="/projects/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nowy projekt
              </Button>
            </Link>
          </div>

          {projects?.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FolderKanban className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Brak projektów</h3>
                <p className="text-slate-500 mb-4">Utwórz pierwszy projekt, aby zacząć zarządzać funduszami.</p>
                <Link href="/projects/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Nowy projekt
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {projects?.map((project, idx) => {
                const participants = projectParticipants[project.id] ?? { total: 0, K: 0, M: 0 }
                const spent = projectExpenses[project.id] ?? 0
                const days = daysRemaining(project.end_date)
                const color = getProjectHexColor(idx)
                const percent = percentOf(spent, project.total_budget ?? 0)

                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer h-full border-slate-200 hover:border-blue-300">
                      <CardContent className="p-5 flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {(project.short_name ?? project.name).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 leading-tight">
                                {project.short_name ?? project.name}
                              </h3>
                              <p className="text-xs text-slate-400 mt-0.5">{project.project_number}</p>
                            </div>
                          </div>
                          <Badge className={statusColors[project.status] ?? ""}>
                            {projectStatusLabel(project.status)}
                          </Badge>
                        </div>

                        {project.organization && (
                          <p className="text-xs text-slate-500 mb-3">{project.organization.name}</p>
                        )}

                        {/* Budget */}
                        <div className="flex-1 space-y-3">
                          {project.total_budget ? (
                            <BudgetProgress
                              planned={project.total_budget}
                              spent={spent}
                              compact
                            />
                          ) : (
                            <p className="text-xs text-slate-400 italic">Brak danych budżetowych</p>
                          )}
                        </div>

                        {/* Footer stats */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              K:{participants.K} M:{participants.M}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-medium ${
                            days < 30 ? "text-red-600" : days < 90 ? "text-amber-600" : "text-slate-500"
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {days > 0 ? `${days} dni` : "Zakończony"}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
