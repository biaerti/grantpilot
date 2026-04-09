"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Bell, CheckSquare, Clock, Phone, Loader2, User, Filter,
  ChevronRight, RotateCcw, Eye, EyeOff,
} from "lucide-react"
import Link from "next/link"
import type { Reminder } from "@/lib/types"

type ReminderWithJoin = Reminder & {
  participant: { id: string; first_name: string; last_name: string; phone?: string | null } | null
  project: { id: string; name: string; short_name?: string | null } | null
}

export default function RemindersPage() {
  const supabase = createClient()

  const [reminders, setReminders] = useState<ReminderWithJoin[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [filterUser, setFilterUser] = useState("")
  const [onlyMine, setOnlyMine] = useState(false)
  const [myInitials, setMyInitials] = useState("")
  const [filterProject, setFilterProject] = useState("all")
  const [projects, setProjects] = useState<{ id: string; short_name?: string | null; name: string }[]>([])

  const fetchReminders = useCallback(async () => {
    setLoading(true)
    const query = supabase
      .from("reminders")
      .select(`
        *,
        participant:participants(id, first_name, last_name, phone),
        project:projects(id, name, short_name)
      `)
      .order("remind_at", { ascending: true })

    if (!showDone) query.eq("done", false)

    const { data } = await query
    setReminders((data ?? []) as unknown as ReminderWithJoin[])
    setLoading(false)
  }, [showDone])

  useEffect(() => {
    fetchReminders()
    supabase.from("projects").select("id, name, short_name").order("name")
      .then(({ data }) => setProjects(data ?? []))
  }, [fetchReminders])

  async function markDone(id: string) {
    await supabase.from("reminders").update({ done: true, done_at: new Date().toISOString() }).eq("id", id)
    setReminders(prev => showDone
      ? prev.map(r => r.id === id ? { ...r, done: true } : r)
      : prev.filter(r => r.id !== id)
    )
    toast.success("Oznaczono jako wykonane")
  }

  async function reassign(id: string, to: string) {
    await supabase.from("reminders").update({ assigned_to: to }).eq("id", id)
    setReminders(prev => prev.map(r => r.id === id ? { ...r, assigned_to: to } : r))
  }

  const filtered = reminders.filter(r => {
    if (onlyMine && myInitials && r.assigned_to !== myInitials) return false
    if (filterUser && r.assigned_to !== filterUser) return false
    if (filterProject !== "all" && r.project_id !== filterProject) return false
    return true
  })

  // Grupuj po dniu
  const grouped: Record<string, ReminderWithJoin[]> = {}
  for (const r of filtered) {
    const day = r.all_day
      ? new Date(r.remind_at).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })
      : new Date(r.remind_at).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(r)
  }

  const uniqueAssignees = Array.from(new Set(reminders.map(r => r.assigned_to).filter(Boolean)))

  const now = new Date()
  const overdueCount = reminders.filter(r => !r.done && new Date(r.remind_at) < now).length
  const todayCount = reminders.filter(r => {
    if (r.done) return false
    const d = new Date(r.remind_at)
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Przypomnienia"
          breadcrumbs={[{ label: "Przypomnienia" }]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Statystyki */}
          <div className="flex flex-wrap gap-3">
            {overdueCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm">
                <Clock className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-red-700">{overdueCount} zaległych</span>
              </div>
            )}
            {todayCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <Bell className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-amber-700">{todayCount} dzisiaj</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
              {filtered.length} przypomnień
            </div>
          </div>

          {/* Filtry */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm text-slate-700 bg-white"
            >
              <option value="all">Wszystkie projekty</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.short_name ?? p.name}</option>
              ))}
            </select>

            {uniqueAssignees.length > 1 && (
              <select
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm text-slate-700 bg-white"
              >
                <option value="">Wszyscy</option>
                {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            <div className="flex items-center gap-2">
              <Input
                placeholder="Moje inicjały"
                value={myInitials}
                onChange={e => setMyInitials(e.target.value.toUpperCase())}
                className="w-28 text-sm"
              />
              <Button
                size="sm"
                variant={onlyMine ? "default" : "outline"}
                onClick={() => setOnlyMine(p => !p)}
                disabled={!myInitials}
              >
                <User className="w-3.5 h-3.5 mr-1" />
                Tylko moje
              </Button>
            </div>

            <Button
              size="sm"
              variant={showDone ? "default" : "outline"}
              onClick={() => setShowDone(p => !p)}
            >
              {showDone ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
              {showDone ? "Ukryj wykonane" : "Pokaż wykonane"}
            </Button>
          </div>

          {/* Lista pogrupowana po dniu */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p>Brak przypomnień</p>
                <p className="text-xs mt-1">Dodaj przypomnienie otwierając lead i klikając ikonę dzwonka</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([day, items]) => {
                const dayDate = new Date(items[0].remind_at)
                const isToday = dayDate.toDateString() === now.toDateString()
                const isPast = dayDate < now && !isToday
                return (
                  <div key={day}>
                    <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${
                      isPast ? "text-red-500" : isToday ? "text-amber-600" : "text-slate-500"
                    }`}>
                      {isPast && <Clock className="w-3.5 h-3.5" />}
                      {isToday && <Bell className="w-3.5 h-3.5" />}
                      {day}
                      {isPast && <Badge variant="destructive" className="text-xs h-4 px-1">zaległe</Badge>}
                      {isToday && <Badge className="text-xs h-4 px-1 bg-amber-100 text-amber-700 border-0">dzisiaj</Badge>}
                    </h3>
                    <div className="space-y-2">
                      {items.map(rem => (
                        <div
                          key={rem.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border bg-white transition-opacity ${
                            rem.done ? "opacity-50" : ""
                          } ${!rem.done && new Date(rem.remind_at) < now ? "border-red-200 bg-red-50/30" : ""}`}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => !rem.done && markDone(rem.id)}
                            disabled={rem.done}
                            className={`mt-0.5 flex-shrink-0 ${rem.done ? "text-green-500" : "text-slate-300 hover:text-green-500"}`}
                          >
                            {rem.done ? <CheckSquare className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </button>

                          {/* Treść */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Lead */}
                              {rem.participant && (
                                <Link
                                  href={`/projects/${rem.project_id}/leads`}
                                  className="font-medium text-sm text-slate-800 hover:text-blue-600 flex items-center gap-1"
                                >
                                  {rem.participant.first_name} {rem.participant.last_name}
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              )}
                              {/* Projekt */}
                              {rem.project && (
                                <span className="text-xs text-slate-400">
                                  {rem.project.short_name ?? rem.project.name}
                                </span>
                              )}
                              {/* Godzina */}
                              {!rem.all_day && (
                                <span className="text-xs font-mono text-slate-500">
                                  {new Date(rem.remind_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>

                            {rem.note && (
                              <p className="text-sm text-slate-600 mt-0.5">{rem.note}</p>
                            )}

                            {/* Telefon leada */}
                            {rem.participant?.phone && (
                              <a
                                href={`tel:${rem.participant.phone}`}
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                <Phone className="w-3 h-3" />{rem.participant.phone}
                              </a>
                            )}
                          </div>

                          {/* Przypisany */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {rem.assigned_to}
                            </span>
                            {/* Przejmij / zmień przypisanie */}
                            {myInitials && rem.assigned_to !== myInitials && !rem.done && (
                              <button
                                type="button"
                                title={`Przejmij na siebie (${myInitials})`}
                                onClick={() => reassign(rem.id, myInitials)}
                                className="text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded border border-transparent hover:border-blue-200"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
