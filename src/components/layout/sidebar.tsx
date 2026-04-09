"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Receipt,
  Settings,
  Plane,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SidebarProps {
  pendingAccountingCount?: number
}

interface ProjectItem {
  id: string
  short_name?: string | null
  name: string
  status: string
}

export function Sidebar({ pendingAccountingCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const supabase = createClient()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [projectsOpen, setProjectsOpen] = useState(true)

  useEffect(() => {
    supabase.from("projects").select("id, short_name, name, status").order("name")
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  const isProjectsActive = pathname.startsWith("/projects")
  const currentProjectId = pathname.match(/\/projects\/([^/]+)/)?.[1]

  return (
    <aside className="fixed left-0 top-0 z-40 h-full w-64 bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500">
          <Plane className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">GrantPilot</h1>
          <p className="text-slate-400 text-xs mt-0.5">Zarządzanie projektami</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">Dashboard</span>
        </Link>

        {/* Projekty – expandable */}
        <div>
          <button
            type="button"
            onClick={() => setProjectsOpen(p => !p)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isProjectsActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <FolderKanban className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-left">Projekty</span>
            {projectsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {projectsOpen && projects.length > 0 && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
              {projects.map(p => {
                const isActive = currentProjectId === p.id
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                      isActive ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", p.status === "active" ? "bg-green-400" : "bg-slate-500")} />
                    <span className="truncate">{p.short_name ?? p.name}</span>
                  </Link>
                )
              })}
              <Link
                href="/projects"
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Wszystkie projekty →
              </Link>
            </div>
          )}
        </div>

        {/* Kalendarz */}
        {(() => {
          const projectMatch = pathname.match(/\/projects\/([^/]+)/)
          const currentProjectId = projectMatch ? projectMatch[1] : null
          const calHref = currentProjectId ? `/calendar?project_id=${currentProjectId}` : "/calendar"
          return (
            <Link
              href={calHref}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/calendar") ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <CalendarDays className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">Kalendarz</span>
              {currentProjectId && !pathname.startsWith("/calendar") && (
                <span className="text-xs text-slate-500 truncate max-w-16">
                  {projects.find(p => p.id === currentProjectId)?.short_name ?? ""}
                </span>
              )}
            </Link>
          )
        })()}

        {/* Rozliczenia */}
        <Link
          href="/accounting"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname.startsWith("/accounting") ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Receipt className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">Rozliczenia</span>
          {pendingAccountingCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1.5">
              {pendingAccountingCount}
            </Badge>
          )}
        </Link>

        {/* Ustawienia */}
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname.startsWith("/settings") ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">Ustawienia</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">Fundusze Europejskie 2021–2027</p>
      </div>
    </aside>
  )
}
