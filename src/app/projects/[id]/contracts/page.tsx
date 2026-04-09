"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import {
  Plus, Trash2, Loader2, Building2, Pencil, X, Check,
  FileText, ChevronDown, ChevronRight, ScrollText, Download, ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Protocol } from "@/lib/types"

interface Contractor {
  id: string
  project_id: string
  name: string
  nip?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  created_at: string
}

interface TaskMin {
  id: string
  number: number
  name: string
}

interface BudgetLineMin {
  id: string
  task_id: string
  sub_number?: string
  name: string
}

interface Contract {
  id: string
  project_id: string
  contractor_id?: string | null
  task_id?: string | null
  budget_line_id?: string | null
  contract_number?: string | null
  name: string
  scope?: string | null
  amount?: number | null
  date_from?: string | null
  date_to?: string | null
  status: string
  document_url?: string | null
  notes?: string | null
  created_at: string
  task?: TaskMin | null
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Szkic", active: "Aktywna", completed: "Zakończona",
}
const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
}
const PROTOCOL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  generated: "bg-teal-100 text-teal-700",
  sent: "bg-blue-100 text-blue-700",
}
const PROTOCOL_STATUS_LABELS: Record<string, string> = {
  draft: "Szkic", generated: "Wygenerowany", sent: "Wysłany",
}

const POLISH_MONTHS_NOM = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
]

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number)
  return `${POLISH_MONTHS_NOM[m - 1]} ${y}`
}

type ContractForm = {
  name: string; contract_number: string; task_id: string; budget_line_id: string
  scope: string; amount: string; date_from: string; date_to: string
  status: string; document_url: string; notes: string
}
const emptyContractForm: ContractForm = {
  name: "", contract_number: "", task_id: "", budget_line_id: "",
  scope: "", amount: "", date_from: "", date_to: "", status: "draft", document_url: "", notes: "",
}

const DEFAULT_CONTRACTORS = ["Ceduro", "BIT Finanse Sp. z o.o.", "Educandis"]

export default function ContractsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [tasks, setTasks] = useState<TaskMin[]>([])
  const [allBudgetLines, setAllBudgetLines] = useState<BudgetLineMin[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Contractor form
  const [showForm, setShowForm] = useState(false)
  const [editingContractorId, setEditingContractorId] = useState<string | null>(null)
  const [savingContractor, setSavingContractor] = useState(false)
  const emptyContractorForm = { name: "", nip: "", email: "", phone: "", address: "", notes: "" }
  const [contractorForm, setContractorForm] = useState(emptyContractorForm)

  // Contract dialog
  const [contractDialog, setContractDialog] = useState<{
    open: boolean; contractorId: string; contractorName: string; editingContract: Contract | null
  }>({ open: false, contractorId: "", contractorName: "", editingContract: null })
  const [contractForm, setContractForm] = useState<ContractForm>(emptyContractForm)
  const [savingContract, setSavingContract] = useState(false)

  // Protocols popover state
  const [openProtocolPopover, setOpenProtocolPopover] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [projectId])

  async function fetchData() {
    const [contractorsRes, contractsRes, protocolsRes, tasksRes, linesRes] = await Promise.all([
      supabase.from("contractors").select("*").eq("project_id", projectId).order("name"),
      supabase.from("contracts").select("*, task:tasks(id,number,name)").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("protocols").select("*, contract:contracts(id,name), contractor:contractors(id,name), task:tasks(id,number,name)").eq("project_id", projectId).order("month", { ascending: false }),
      supabase.from("tasks").select("id,number,name").eq("project_id", projectId).order("number"),
      supabase.from("budget_lines").select("id,task_id,sub_number,name").eq("project_id", projectId),
    ])
    setContractors(contractorsRes.data ?? [])
    setContracts((contractsRes.data ?? []) as unknown as Contract[])
    setProtocols((protocolsRes.data ?? []) as unknown as Protocol[])
    setTasks(tasksRes.data ?? [])
    setAllBudgetLines(linesRes.data ?? [])
    setLoading(false)
  }

  // ── Contractor handlers ──

  const handleSaveContractor = async () => {
    if (!contractorForm.name.trim()) { toast.error("Podaj nazwę wykonawcy."); return }
    setSavingContractor(true)
    if (editingContractorId) {
      const { error } = await supabase.from("contractors").update({
        name: contractorForm.name,
        nip: contractorForm.nip || null,
        email: contractorForm.email || null,
        phone: contractorForm.phone || null,
        address: contractorForm.address || null,
        notes: contractorForm.notes || null,
      }).eq("id", editingContractorId)
      if (error) { toast.error("Błąd: " + error.message); setSavingContractor(false); return }
      setContractors(prev => prev.map(c => c.id === editingContractorId ? { ...c, ...contractorForm } : c))
      toast.success("Zapisano.")
      setEditingContractorId(null)
    } else {
      const { data, error } = await supabase.from("contractors").insert({
        project_id: projectId,
        name: contractorForm.name,
        nip: contractorForm.nip || null,
        email: contractorForm.email || null,
        phone: contractorForm.phone || null,
        address: contractorForm.address || null,
        notes: contractorForm.notes || null,
      }).select().single()
      if (error) { toast.error("Błąd: " + error.message); setSavingContractor(false); return }
      setContractors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Wykonawca dodany!")
      setShowForm(false)
    }
    setContractorForm(emptyContractorForm)
    setSavingContractor(false)
  }

  const handleDeleteContractor = async (id: string, name: string) => {
    if (!confirm(`Usunąć wykonawcę "${name}"?`)) return
    const { error } = await supabase.from("contractors").delete().eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContractors(prev => prev.filter(c => c.id !== id))
    setContracts(prev => prev.filter(c => c.contractor_id !== id))
    toast.success("Usunięto.")
  }

  const startEditContractor = (c: Contractor) => {
    setEditingContractorId(c.id)
    setContractorForm({ name: c.name, nip: c.nip ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" })
    setShowForm(false)
  }

  const addDefaultContractor = async (name: string) => {
    const { data, error } = await supabase.from("contractors").insert({ project_id: projectId, name }).select().single()
    if (error) { toast.error("Błąd: " + error.message); return }
    setContractors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    toast.success(`"${name}" dodany!`)
  }

  // ── Contract handlers ──

  const openAddContract = (contractorId: string, contractorName: string) => {
    setContractForm({ ...emptyContractForm, date_from: new Date().toISOString().slice(0, 10) })
    setContractDialog({ open: true, contractorId, contractorName, editingContract: null })
  }

  const openEditContract = (contract: Contract, contractorName: string) => {
    setContractForm({
      name: contract.name,
      contract_number: contract.contract_number ?? "",
      task_id: contract.task_id ?? "",
      budget_line_id: contract.budget_line_id ?? "",
      scope: contract.scope ?? "",
      amount: contract.amount != null ? String(contract.amount) : "",
      date_from: contract.date_from ?? "",
      date_to: contract.date_to ?? "",
      status: contract.status,
      document_url: contract.document_url ?? "",
      notes: contract.notes ?? "",
    })
    setContractDialog({ open: true, contractorId: contract.contractor_id ?? "", contractorName, editingContract: contract })
  }

  const handleSaveContract = async () => {
    if (!contractForm.name.trim()) { toast.error("Podaj nazwę umowy."); return }
    setSavingContract(true)
    const payload = {
      project_id: projectId,
      contractor_id: contractDialog.contractorId,
      task_id: contractForm.task_id || null,
      budget_line_id: contractForm.budget_line_id || null,
      contract_number: contractForm.contract_number || null,
      name: contractForm.name,
      scope: contractForm.scope || null,
      amount: parseFloat(contractForm.amount) || null,
      date_from: contractForm.date_from || null,
      date_to: contractForm.date_to || null,
      status: contractForm.status,
      document_url: contractForm.document_url || null,
      notes: contractForm.notes || null,
    }
    if (contractDialog.editingContract) {
      const { error } = await supabase.from("contracts").update(payload).eq("id", contractDialog.editingContract.id)
      if (error) { toast.error("Błąd: " + error.message); setSavingContract(false); return }
      setContracts(prev => prev.map(c => c.id === contractDialog.editingContract!.id
        ? { ...c, ...payload, task: tasks.find(t => t.id === contractForm.task_id) ?? null }
        : c
      ))
      toast.success("Umowa zaktualizowana!")
    } else {
      const { data, error } = await supabase.from("contracts").insert(payload).select("*, task:tasks(id,number,name)").single()
      if (error) { toast.error("Błąd: " + error.message); setSavingContract(false); return }
      setContracts(prev => [data as unknown as Contract, ...prev])
      toast.success("Umowa dodana!")
    }
    setSavingContract(false)
    setContractDialog({ open: false, contractorId: "", contractorName: "", editingContract: null })
  }

  const handleDeleteContract = async (id: string, name: string) => {
    if (!confirm(`Usunąć umowę "${name}"?`)) return
    const { error } = await supabase.from("contracts").delete().eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContracts(prev => prev.filter(c => c.id !== id))
    toast.success("Usunięto.")
  }

  const missingDefaults = DEFAULT_CONTRACTORS.filter(d => !contractors.some(c => c.name === d))
  const budgetLinesForTask = allBudgetLines.filter(l => l.task_id === contractForm.task_id)

  // Protokoły per umowa
  const protocolsByContract = protocols.reduce((acc, p) => {
    if (!p.contract_id) return acc
    if (!acc[p.contract_id]) acc[p.contract_id] = []
    acc[p.contract_id].push(p)
    return acc
  }, {} as Record<string, Protocol[]>)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Umowy i wykonawcy"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Umowy" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              ← Wróć do projektu
            </Link>
            <div className="flex gap-2">
              <Link href={`/projects/${projectId}/protocols`}>
                <Button variant="outline" size="sm">
                  <ScrollText className="w-4 h-4 mr-1" />Protokoły →
                </Button>
              </Link>
              <Button size="sm" onClick={() => { setShowForm(true); setEditingContractorId(null); setContractorForm(emptyContractorForm) }}>
                <Plus className="w-4 h-4 mr-1" />Dodaj wykonawcę
              </Button>
            </div>
          </div>

          {/* Quick-add defaults */}
          {missingDefaults.length > 0 && (
            <Card className="border-blue-100 bg-blue-50">
              <CardContent className="p-4">
                <p className="text-sm text-slate-600 mb-2 font-medium">Szybko dodaj typowych wykonawców:</p>
                <div className="flex flex-wrap gap-2">
                  {missingDefaults.map(name => (
                    <Button key={name} size="sm" variant="outline" className="bg-white" onClick={() => addDefaultContractor(name)}>
                      <Plus className="w-3 h-3 mr-1" />{name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add contractor form */}
          {showForm && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm">Nowy wykonawca</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Nazwa *</Label>
                    <Input placeholder="Np. Ceduro Sp. z o.o." value={contractorForm.name} onChange={e => setContractorForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIP</Label>
                    <Input placeholder="0000000000" value={contractorForm.nip} onChange={e => setContractorForm(p => ({ ...p, nip: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefon</Label>
                    <Input placeholder="+48 000 000 000" value={contractorForm.phone} onChange={e => setContractorForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input placeholder="kontakt@firma.pl" value={contractorForm.email} onChange={e => setContractorForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Adres</Label>
                    <Input value={contractorForm.address} onChange={e => setContractorForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Notatki</Label>
                    <Textarea rows={2} value={contractorForm.notes} onChange={e => setContractorForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveContractor} disabled={savingContractor}>
                    {savingContractor ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}Zapisz
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Anuluj</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contractors list */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
          ) : contractors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p>Brak wykonawców.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contractors.map(c => {
                const contractorContracts = contracts.filter(ct => ct.contractor_id === c.id)
                const isExpanded = expanded[c.id] ?? false
                return (
                  <Card key={c.id}>
                    <CardContent className="p-0">
                      {editingContractorId === c.id ? (
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Nazwa *</Label>
                              <Input value={contractorForm.name} onChange={e => setContractorForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">NIP</Label>
                              <Input value={contractorForm.nip} onChange={e => setContractorForm(p => ({ ...p, nip: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Telefon</Label>
                              <Input value={contractorForm.phone} onChange={e => setContractorForm(p => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input value={contractorForm.email} onChange={e => setContractorForm(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Adres</Label>
                              <Input value={contractorForm.address} onChange={e => setContractorForm(p => ({ ...p, address: e.target.value }))} />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Notatki</Label>
                              <Textarea rows={2} value={contractorForm.notes} onChange={e => setContractorForm(p => ({ ...p, notes: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveContractor} disabled={savingContractor}>
                              <Check className="w-3.5 h-3.5 mr-1" />Zapisz
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingContractorId(null)}>
                              <X className="w-3.5 h-3.5 mr-1" />Anuluj
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Contractor header */}
                          <div className="flex items-center justify-between p-4">
                            <button
                              className="flex items-center gap-3 flex-1 text-left min-w-0"
                              onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                            >
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              }
                              <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">{c.name}</p>
                                <div className="flex flex-wrap gap-3 mt-0.5 text-sm text-slate-500">
                                  {c.nip && <span>NIP: {c.nip}</span>}
                                  {c.email && <span>{c.email}</span>}
                                  {c.phone && <span>{c.phone}</span>}
                                </div>
                              </div>
                            </button>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-slate-400">
                                {contractorContracts.length} {contractorContracts.length === 1 ? "umowa" : contractorContracts.length < 5 ? "umowy" : "umów"}
                              </span>
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openAddContract(c.id, c.name)}>
                                <Plus className="w-3.5 h-3.5 mr-1" />Dodaj umowę
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditContractor(c)}>
                                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteContractor(c.id, c.name)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Contracts (expanded) */}
                          {isExpanded && (
                            <div className="border-t">
                              {contractorContracts.length === 0 ? (
                                <p className="text-sm text-slate-400 p-4 text-center">
                                  Brak umów.{" "}
                                  <button className="text-blue-600 hover:underline" onClick={() => openAddContract(c.id, c.name)}>
                                    Dodaj pierwszą umowę →
                                  </button>
                                </p>
                              ) : (
                                <div className="divide-y">
                                  {contractorContracts.map(ct => {
                                    const contractProtocols = protocolsByContract[ct.id] ?? []
                                    return (
                                      <div key={ct.id} className="flex items-start justify-between p-3 pl-11 hover:bg-slate-50">
                                        <div className="flex items-start gap-3 min-w-0">
                                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <p className="text-sm font-medium text-slate-800">{ct.name}</p>
                                              {ct.contract_number && (
                                                <span className="text-xs text-slate-400 font-mono">{ct.contract_number}</span>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-slate-500">
                                              {ct.task && <span>Zad. {ct.task.number}: {ct.task.name}</span>}
                                              {ct.date_from && <span>{formatDate(ct.date_from)}{ct.date_to ? " – " + formatDate(ct.date_to) : ""}</span>}
                                            </div>
                                            {ct.scope && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-lg">{ct.scope}</p>}
                                            {/* Rozliczenie finansowe */}
                                            {ct.amount != null && (() => {
                                              const settled = contractProtocols.reduce((s, p) => s + (p.total_amount ?? 0), 0)
                                              const remaining = ct.amount - settled
                                              const pct = ct.amount > 0 ? Math.min(100, Math.round((settled / ct.amount) * 100)) : 0
                                              return (
                                                <div className="mt-1.5 space-y-1">
                                                  <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-slate-500">Umowa: <span className="font-medium text-slate-700">{formatCurrency(ct.amount)}</span></span>
                                                    <span className="text-green-700">Rozliczono: <span className="font-medium">{formatCurrency(settled)}</span></span>
                                                    <span className={remaining > 0 ? "text-amber-600" : "text-slate-400"}>
                                                      Pozostało: <span className="font-medium">{formatCurrency(remaining)}</span>
                                                    </span>
                                                  </div>
                                                  <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-xs">
                                                    <div
                                                      className={`h-1.5 rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-teal-500" : "bg-slate-200"}`}
                                                      style={{ width: `${pct}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              )
                                            })()}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <Badge className={CONTRACT_STATUS_COLORS[ct.status] ?? ""}>
                                            {CONTRACT_STATUS_LABELS[ct.status] ?? ct.status}
                                          </Badge>

                                          {/* Protokoły badge + popover */}
                                          <Popover open={openProtocolPopover === ct.id} onOpenChange={open => setOpenProtocolPopover(open ? ct.id : null)}>
                                            <PopoverTrigger className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                                                contractProtocols.length > 0
                                                  ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                              }`}>
                                              <ScrollText className="w-3 h-3" />
                                              {contractProtocols.length}
                                            </PopoverTrigger>
                                            <PopoverContent align="end" className="w-80 p-0">
                                              <div className="p-3 border-b">
                                                <p className="font-semibold text-sm flex items-center gap-2">
                                                  <ScrollText className="w-4 h-4 text-teal-600" />
                                                  Protokoły — {ct.name}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">{contractProtocols.length} protokołów łącznie</p>
                                              </div>
                                              {contractProtocols.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-slate-400">
                                                  Brak protokołów.<br />
                                                  <Link href={`/projects/${projectId}/settlement`} className="text-blue-600 hover:underline text-xs">
                                                    Generuj w Rozliczeniu →
                                                  </Link>
                                                </div>
                                              ) : (
                                                <div className="max-h-64 overflow-y-auto divide-y">
                                                  {contractProtocols.map(p => (
                                                    <div key={p.id} className="p-3 hover:bg-slate-50">
                                                      <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                          <p className="text-sm font-medium text-slate-800">{formatMonth(p.month)}</p>
                                                          <p className="text-xs text-slate-500 mt-0.5">
                                                            {p.event_count} zdarzeń · {p.total_hours}h · {p.total_participants} os.
                                                          </p>
                                                          {p.content_summary && (
                                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.content_summary}</p>
                                                          )}
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                          <span className={`text-xs px-1.5 py-0.5 rounded ${PROTOCOL_STATUS_COLORS[p.status]}`}>
                                                            {PROTOCOL_STATUS_LABELS[p.status]}
                                                          </span>
                                                          {p.document_url && (
                                                            <a href={p.document_url} target="_blank" rel="noopener noreferrer" title="Pobierz DOCX">
                                                              <Download className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
                                                            </a>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              <div className="p-2 border-t">
                                                <Link href={`/projects/${projectId}/protocols`} className="block w-full text-center text-xs text-blue-600 hover:underline py-1">
                                                  Wszystkie protokoły projektu →
                                                </Link>
                                              </div>
                                            </PopoverContent>
                                          </Popover>

                                          {ct.document_url && (
                                            <a href={ct.document_url} target="_blank" rel="noopener noreferrer" title="Dokument umowy">
                                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                                            </a>
                                          )}
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditContract(ct, c.name)}>
                                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteContract(ct.id, ct.name)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Contract dialog */}
      <Dialog open={contractDialog.open} onOpenChange={open => !open && setContractDialog(p => ({ ...p, open: false }))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {contractDialog.editingContract ? "Edytuj umowę" : "Nowa umowa"} — {contractDialog.contractorName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nazwa umowy *</Label>
                <Input
                  placeholder="Np. Umowa zlecenie – doradztwo zawodowe"
                  value={contractForm.name}
                  onChange={e => setContractForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Numer umowy</Label>
                <Input
                  placeholder="Np. ZL/001/2026"
                  value={contractForm.contract_number}
                  onChange={e => setContractForm(p => ({ ...p, contract_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={contractForm.status} onValueChange={v => setContractForm(p => ({ ...p, status: v ?? "draft" }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Szkic</SelectItem>
                    <SelectItem value="active">Aktywna</SelectItem>
                    <SelectItem value="completed">Zakończona</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zadanie</Label>
                <Select value={contractForm.task_id} onValueChange={v => setContractForm(p => ({ ...p, task_id: v ?? "", budget_line_id: "" }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                  <SelectContent>
                    {tasks.map(t => <SelectItem key={t.id} value={t.id}>Zad. {t.number}: {t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Podzadanie</Label>
                <Select value={contractForm.budget_line_id} onValueChange={v => setContractForm(p => ({ ...p, budget_line_id: v ?? "" }))} disabled={!contractForm.task_id}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Opcjonalnie..." /></SelectTrigger>
                  <SelectContent>
                    {budgetLinesForTask.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.sub_number ? `${l.sub_number} – ` : ""}{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data od</Label>
                <Input type="date" value={contractForm.date_from} onChange={e => setContractForm(p => ({ ...p, date_from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data do</Label>
                <Input type="date" value={contractForm.date_to} onChange={e => setContractForm(p => ({ ...p, date_to: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Kwota umowy (zł)</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={contractForm.amount} onChange={e => setContractForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Zakres / przedmiot umowy</Label>
                <Textarea rows={2} placeholder="Np. Realizacja 40 sesji doradztwa zawodowego..." value={contractForm.scope} onChange={e => setContractForm(p => ({ ...p, scope: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Link do dokumentu</Label>
                <Input placeholder="https://... lub ścieżka" value={contractForm.document_url} onChange={e => setContractForm(p => ({ ...p, document_url: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Notatki</Label>
                <Textarea rows={2} value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialog(p => ({ ...p, open: false }))}>Anuluj</Button>
            <Button onClick={handleSaveContract} disabled={savingContract}>
              {savingContract ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Zapisz umowę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
