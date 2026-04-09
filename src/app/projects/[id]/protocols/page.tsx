"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  Loader2, ScrollText, Download, Trash2, ChevronDown, ChevronRight,
  ArrowLeft, Clock, Users, Wallet,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import type { Protocol } from "@/lib/types"

const POLISH_MONTHS_NOM = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
]

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number)
  return `${POLISH_MONTHS_NOM[m - 1]} ${y}`
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  generated: "bg-teal-100 text-teal-700",
  sent: "bg-blue-100 text-blue-700",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic", generated: "Wygenerowany", sent: "Wysłany",
}
const STATUS_NEXT: Record<string, string> = {
  draft: "generated", generated: "sent",
}

export default function ProtocolsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filterMonth, setFilterMonth] = useState("all")

  useEffect(() => { fetchProtocols() }, [projectId])

  async function fetchProtocols() {
    const { data, error } = await supabase
      .from("protocols")
      .select(`
        *,
        contract:contracts(id, name, contract_number),
        contractor:contractors(id, name),
        task:tasks(id, number, name)
      `)
      .eq("project_id", projectId)
      .order("month", { ascending: false })
    if (error) { toast.error("Błąd ładowania: " + error.message); return }
    setProtocols((data ?? []) as unknown as Protocol[])
    setLoading(false)
  }

  async function handleUpdateStatus(id: string, status: string) {
    const { error } = await supabase.from("protocols").update({ status }).eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setProtocols(prev => prev.map(p => p.id === id ? { ...p, status: status as Protocol["status"] } : p))
    toast.success("Status zaktualizowany.")
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć protokół?")) return
    const { error } = await supabase.from("protocols").delete().eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setProtocols(prev => prev.filter(p => p.id !== id))
    toast.success("Usunięto.")
  }

  // Unikalne miesiące
  const months = [...new Set(protocols.map(p => p.month))].sort((a, b) => b.localeCompare(a))
  const filtered = filterMonth === "all" ? protocols : protocols.filter(p => p.month === filterMonth)

  // Grupuj po miesiącu
  const byMonth = filtered.reduce((acc, p) => {
    if (!acc[p.month]) acc[p.month] = []
    acc[p.month].push(p)
    return acc
  }, {} as Record<string, Protocol[]>)

  const sortedMonths = Object.keys(byMonth).sort((a, b) => b.localeCompare(a))

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Protokoły odbioru"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Protokoły" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" />
              Wróć do projektu
            </Link>
            <div className="flex items-center gap-3">
              {months.length > 0 && (
                <Select value={filterMonth} onValueChange={v => setFilterMonth(v ?? "all")}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue placeholder="Wszystkie miesiące" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie miesiące</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Link href={`/projects/${projectId}/settlement`}>
                <Button size="sm" variant="outline">
                  Generuj w Rozliczeniu →
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
          ) : protocols.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ScrollText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium">Brak protokołów odbioru</p>
                <p className="text-slate-400 text-sm mt-1">
                  Protokoły generujesz z poziomu modułu{" "}
                  <Link href={`/projects/${projectId}/settlement`} className="text-blue-600 hover:underline">
                    Rozliczenie
                  </Link>.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedMonths.map(month => {
                const items = byMonth[month]
                const isExpanded = expanded.has(month)
                const totalHours = items.reduce((s, p) => s + (p.total_hours ?? 0), 0)
                const totalAmount = items.reduce((s, p) => s + (p.total_amount ?? 0), 0)
                const totalPart = items.reduce((s, p) => s + (p.total_participants ?? 0), 0)
                return (
                  <Card key={month} className="overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => setExpanded(prev => {
                        const next = new Set(prev)
                        next.has(month) ? next.delete(month) : next.add(month)
                        return next
                      })}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                        <span className="font-semibold text-slate-800">{formatMonth(month)}</span>
                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                          {items.length} {items.length === 1 ? "protokół" : items.length < 5 ? "protokoły" : "protokołów"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{totalHours}h</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{totalPart} os.</span>
                        <span className="flex items-center gap-1 text-green-700 font-medium"><Wallet className="w-3 h-3" />{formatCurrency(totalAmount)}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t divide-y">
                        {items.map(p => (
                          <div key={p.id} className="flex items-start justify-between p-4 hover:bg-slate-50 gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <ScrollText className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-slate-900">
                                    {p.contractor?.name ?? "—"}
                                  </p>
                                  {p.contract && (
                                    <span className="text-xs text-slate-500">{p.contract.name}</span>
                                  )}
                                  {p.contract?.contract_number && (
                                    <span className="text-xs font-mono text-slate-400">{p.contract.contract_number}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                                  {p.task && <span>Zad. {p.task.number}: {p.task.name}</span>}
                                  <span>{p.event_count} zdarzeń</span>
                                  <span>{p.total_hours}h</span>
                                  <span>{p.total_participants} uczestników</span>
                                  <span className="text-green-700 font-medium">{formatCurrency(p.total_amount)}</span>
                                </div>
                                {p.content_summary && (
                                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.content_summary}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Status select */}
                              <Select value={p.status} onValueChange={v => v && handleUpdateStatus(p.id, v)}>
                                <SelectTrigger className={`h-6 text-xs px-2 w-auto border-0 ${STATUS_COLORS[p.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="draft">Szkic</SelectItem>
                                  <SelectItem value="generated">Wygenerowany</SelectItem>
                                  <SelectItem value="sent">Wysłany</SelectItem>
                                </SelectContent>
                              </Select>

                              {p.document_url ? (
                                <a href={p.document_url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                    <Download className="w-3 h-3" />DOCX
                                  </Button>
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 px-2">brak pliku</span>
                              )}
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                                onClick={() => handleDelete(p.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
