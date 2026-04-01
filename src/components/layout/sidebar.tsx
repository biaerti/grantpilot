"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Receipt,
  Settings,
  Plane,
  ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface SidebarProps {
  pendingAccountingCount?: number
}

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/projects",
    label: "Projekty",
    icon: FolderKanban,
  },
  {
    href: "/calendar",
    label: "Kalendarz",
    icon: CalendarDays,
  },
  {
    href: "/accounting",
    label: "Rozliczenia",
    icon: Receipt,
    badge: true,
  },
  {
    href: "/settings",
    label: "Ustawienia",
    icon: Settings,
  },
]

export function Sidebar({ pendingAccountingCount = 0 }: SidebarProps) {
  const pathname = usePathname()

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingAccountingCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 text-xs px-1.5"
                >
                  {pendingAccountingCount}
                </Badge>
              )}
              {isActive && (
                <ChevronRight className="w-4 h-4 opacity-50" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700">
        <p className="text-slate-500 text-xs">
          Fundusze Europejskie 2021–2027
        </p>
      </div>
    </aside>
  )
}
