"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { degurbaLabel, formatDateShort, genderLabel } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, Upload, Search, Users, Loader2, UserCircle, X } from "lucide-react"
import type { Participant, Project } from "@/lib/types"

// SL CSV column mapping
const SL_COLUMNS = [
  "project_number", "nationality", "participant_type", "institution",
  "first_name", "last_name", "pesel", "no_pesel", "technical_id",
  "gender", "age_at_start", "education_level", "country",
  "voivodeship", "county", "commune", "city", "postal_code",
  "degurba", "phone", "email", "project_start_date", "project_end_date",
  "employment_status", "employment_detail", "education_end_date",
  "situation_at_end", "completed_path", "support_type", "support_form",
  "support_detail", "support_start_date", "business_start_date",
  "foreign_origin", "third_country_citizen", "minority", "homeless",
  "disability", "sl_added_at", "sl_added_by", "last_modified_at",
  "last_modified_by", "data_source"
]

function parseBool(v: string): boolean {
  return v?.toLowerCase() === "tak" || v?.toLowerCase() === "true" || v === "1"
}

function parseDegurba(v: string): number | null {
  if (v?.includes("1") || v?.toLowerCase().includes("miasto")) return 1
  if (v?.includes("2") || v?.toLowerCase().includes("podmiej")) return 2
  if (v?.includes("3") || v?.toLowerCase().includes("wiejsk")) return 3
  return null
}

export default function ParticipantsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterGender, setFilterGender] = useState("all")

  const [addDialog, setAddDialog] = useState(false)
  const [importDialog, setImportDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [csvRaw, setCsvRaw] = useState<string>("")
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [newParticipant, setNewParticipant] = useState({
    first_name: "", last_name: "", pesel: "", gender: "",
    age_at_start: "", city: "", county: "", voivodeship: "",
    degurba: "", phone: "", email: "", employment_status: "",
    support_start_date: "", notes: "",
  })

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    const [projectRes, participantsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("participants").select("*").eq("project_id", projectId).order("last_name"),
    ])
    setProject(projectRes.data)
    setParticipants(participantsRes.data ?? [])
    setLoading(false)
  }

  const filtered = participants.filter((p) => {
    const matchesSearch =
      !search ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.pesel?.includes(search) ||
      p.city?.toLowerCase().includes(search.toLowerCase())
    const matchesGender = filterGender === "all" || p.gender === filterGender
    return matchesSearch && matchesGender
  })

  const stats = {
    total: participants.length,
    K: participants.filter((p) => p.gender === "K").length,
    M: participants.filter((p) => p.gender === "M").length,
    age55: participants.filter((p) => (p.age_at_start ?? 0) >= 55).length,
    rural: participants.filter((p) => p.degurba === 3).length,
    disabled: participants.filter((p) => p.disability).length,
  }

  const handleAddParticipant = async () => {
    if (!newParticipant.first_name || !newParticipant.last_name) {
      toast.error("Podaj imię i nazwisko.")
      return
    }
    setSaving(true)

    const { data, error } = await supabase
      .from("participants")
      .insert({
        project_id: projectId,
        first_name: newParticipant.first_name,
        last_name: newParticipant.last_name,
        pesel: newParticipant.pesel || null,
        gender: newParticipant.gender || null,
        age_at_start: parseInt(newParticipant.age_at_start) || null,
        city: newParticipant.city || null,
        county: newParticipant.county || null,
        voivodeship: newParticipant.voivodeship || null,
        degurba: parseInt(newParticipant.degurba) || null,
        phone: newParticipant.phone || null,
        email: newParticipant.email || null,
        employment_status: newParticipant.employment_status || null,
        support_start_date: newParticipant.support_start_date || null,
        notes: newParticipant.notes || null,
        source: "manual",
      })
      .select()
      .single()

    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }

    setParticipants((prev) => [...prev, data])
    setAddDialog(false)
    setNewParticipant({
      first_name: "", last_name: "", pesel: "", gender: "",
      age_at_start: "", city: "", county: "", voivodeship: "",
      degurba: "", phone: "", email: "", employment_status: "",
      support_start_date: "", notes: "",
    })
    toast.success("Uczestnik dodany!")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvRaw(text)
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      const preview = lines.slice(0, 6).map((l) => l.split(";"))
      setCsvPreview(preview)
    }
    reader.readAsText(file, "utf-8")
  }

  const handleImport = async () => {
    if (!csvRaw) { toast.error("Załaduj plik CSV."); return }
    setImporting(true)

    const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim())
    // Skip header row
    const dataLines = lines.slice(1)
    const toInsert = []

    for (const line of dataLines) {
      const cols = line.split(";").map((c) => c.trim().replace(/^"|"$/g, ""))
      if (cols.length < 5) continue

      const get = (idx: number) => cols[idx] ?? ""

      toInsert.push({
        project_id: projectId,
        first_name: get(4),
        last_name: get(5),
        pesel: get(6) || null,
        no_pesel: parseBool(get(7)),
        technical_id: get(8) || null,
        gender: get(9) || null,
        age_at_start: parseInt(get(10)) || null,
        education_level: get(11) || null,
        country: get(12) || "Polska",
        voivodeship: get(13) || null,
        county: get(14) || null,
        commune: get(15) || null,
        city: get(16) || null,
        postal_code: get(17) || null,
        degurba: parseDegurba(get(18)),
        phone: get(19) || null,
        email: get(20) || null,
        project_start_date: get(21) || null,
        project_end_date: get(22) || null,
        employment_status: get(23) || null,
        employment_detail: get(24) || null,
        situation_at_end: get(26) || null,
        completed_path: parseBool(get(27)),
        support_type: get(28) || null,
        support_form: get(29) || null,
        support_start_date: get(31) || null,
        foreign_origin: parseBool(get(33)),
        third_country_citizen: parseBool(get(34)),
        minority: parseBool(get(35)),
        homeless: parseBool(get(36)),
        disability: parseBool(get(37)),
        sl_added_at: get(38) || null,
        sl_added_by: get(39) || null,
        nationality: get(1) || "Obywatelstwo polskie",
        source: "import",
      })
    }

    if (toInsert.length === 0) {
      setImporting(false)
      toast.error("Brak danych do importu.")
      return
    }

    // Insert in batches of 100
    let successCount = 0
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100)
      const { data, error } = await supabase
        .from("participants")
        .upsert(batch, { onConflict: "pesel,project_id", ignoreDuplicates: true })
        .select()
      if (!error && data) successCount += data.length
    }

    setImporting(false)
    setImportDialog(false)
    setCsvPreview([])
    setCsvRaw("")
    toast.success(`Zaimportowano ${successCount} uczestników!`)
    fetchData()
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Uczestnicy"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Uczestnicy" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: "Łącznie", value: stats.total, color: "bg-blue-50 text-blue-700" },
              { label: "Kobiety", value: stats.K, color: "bg-pink-50 text-pink-700" },
              { label: "Mężczyźni", value: stats.M, color: "bg-indigo-50 text-indigo-700" },
              { label: "55+ lat", value: stats.age55, color: "bg-amber-50 text-amber-700" },
              { label: "Wiejski", value: stats.rural, color: "bg-green-50 text-green-700" },
              { label: "Niepełnosprawni", value: stats.disabled, color: "bg-purple-50 text-purple-700" },
            ].map((s) => (
              <Card key={s.label} className="text-center">
                <CardContent className={`p-3 ${s.color} rounded-lg`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Szukaj po imieniu, nazwisku..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterGender} onValueChange={(v) => setFilterGender(v ?? "all")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy</SelectItem>
                  <SelectItem value="K">Kobiety (K)</SelectItem>
                  <SelectItem value="M">Mężczyźni (M)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportDialog(true)}>
                <Upload className="w-4 h-4 mr-1" />
                Importuj CSV
              </Button>
              <Button size="sm" onClick={() => setAddDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj uczestnika
              </Button>
            </div>
          </div>

          {/* Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Imię i nazwisko</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Płeć</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Wiek</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Powiat</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Obszar</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Status zawod.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Wsparcie od</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Źródło</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        {search || filterGender !== "all"
                          ? "Brak wyników spełniających kryteria."
                          : "Brak uczestników. Dodaj lub zaimportuj uczestników."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserCircle className="w-6 h-6 text-slate-300 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-slate-900">{p.first_name} {p.last_name}</p>
                              {p.pesel && <p className="text-xs text-slate-400">{p.pesel}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={p.gender === "K" ? "border-pink-300 text-pink-700" : p.gender === "M" ? "border-blue-300 text-blue-700" : ""}>
                            {p.gender ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.age_at_start ? (
                            <span>
                              {p.age_at_start}
                              {p.age_at_start >= 55 && <span className="ml-1 text-amber-600 text-xs font-medium">55+</span>}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.county ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.degurba === 3 ? "bg-green-100 text-green-700" :
                            p.degurba === 2 ? "bg-amber-100 text-amber-700" :
                            p.degurba === 1 ? "bg-blue-100 text-blue-700" : "text-slate-400"
                          }`}>
                            {degurbaLabel(p.degurba)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{p.employment_status ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{formatDateShort(p.support_start_date)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {p.source === "import" ? "SL" : "Ręcznie"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>

      {/* Add participant dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj uczestnika</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Imię *</Label>
                <Input value={newParticipant.first_name} onChange={(e) => setNewParticipant((p) => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nazwisko *</Label>
                <Input value={newParticipant.last_name} onChange={(e) => setNewParticipant((p) => ({ ...p, last_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PESEL</Label>
                <Input value={newParticipant.pesel} onChange={(e) => setNewParticipant((p) => ({ ...p, pesel: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Płeć</Label>
                <Select value={newParticipant.gender} onValueChange={(v) => setNewParticipant((p) => ({ ...p, gender: v ?? "" }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K">Kobieta (K)</SelectItem>
                    <SelectItem value="M">Mężczyzna (M)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wiek</Label>
                <Input type="number" value={newParticipant.age_at_start} onChange={(e) => setNewParticipant((p) => ({ ...p, age_at_start: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Obszar (DEGURBA)</Label>
                <Select value={newParticipant.degurba} onValueChange={(v) => setNewParticipant((p) => ({ ...p, degurba: v ?? "" }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 – Miasto</SelectItem>
                    <SelectItem value="2">2 – Podmiejski</SelectItem>
                    <SelectItem value="3">3 – Wiejski</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Miejscowość</Label>
                <Input value={newParticipant.city} onChange={(e) => setNewParticipant((p) => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Powiat</Label>
                <Input value={newParticipant.county} onChange={(e) => setNewParticipant((p) => ({ ...p, county: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefon</Label>
                <Input value={newParticipant.phone} onChange={(e) => setNewParticipant((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={newParticipant.email} onChange={(e) => setNewParticipant((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Data rozpoczęcia wsparcia</Label>
                <Input type="date" value={newParticipant.support_start_date} onChange={(e) => setNewParticipant((p) => ({ ...p, support_start_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Anuluj</Button>
            <Button onClick={handleAddParticipant} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importuj uczestników z CSV (format SL)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Wgraj plik CSV z systemu SL (eksport uczestników). Format: rozdzielony średnikami, nagłówek w pierwszym wierszu.
            </p>

            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">Kliknij lub przeciągnij plik CSV</p>
              <p className="text-xs text-slate-400 mt-1">Obsługiwany format: SL2014/SL2021</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {csvPreview.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Podgląd (pierwsze {csvPreview.length - 1} wierszy danych):
                </p>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="text-xs">
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className={i === 0 ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"}>
                          {row.slice(4, 10).map((cell, j) => (
                            <td key={j} className="px-2 py-1 border-r border-slate-200 whitespace-nowrap max-w-24 truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Pokazano kolumny 5–10 (Imię, Nazwisko, PESEL, brak PESEL, ID techniczny, Płeć)
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialog(false); setCsvPreview([]); setCsvRaw("") }}>
              Anuluj
            </Button>
            <Button onClick={handleImport} disabled={importing || !csvRaw}>
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importuję...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importuj
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
