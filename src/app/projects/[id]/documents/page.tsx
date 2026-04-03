"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  FolderOpen, FileText, Upload, Trash2, Download, Plus,
  Search, Loader2, X, Settings, ChevronDown, ChevronRight,
} from "lucide-react"
import type { Project, ParticipantDocument, DocumentType, Participant } from "@/lib/types"

interface DocWithParticipant extends ParticipantDocument {
  participant?: Pick<Participant, "id" | "first_name" | "last_name"> | null
  document_type?: DocumentType | null
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [docs, setDocs] = useState<DocWithParticipant[]>([])
  const [docTypes, setDocTypes] = useState<DocumentType[]>([])
  const [participants, setParticipants] = useState<Pick<Participant, "id" | "first_name" | "last_name">[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterParticipant, setFilterParticipant] = useState("all")

  // Upload dialog
  const [uploadDialog, setUploadDialog] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newDoc, setNewDoc] = useState({ participant_id: "", document_type_id: "", name: "", notes: "" })
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Types management dialog
  const [typesDialog, setTypesDialog] = useState(false)
  const [newTypeName, setNewTypeName] = useState("")
  const [newTypeRequired, setNewTypeRequired] = useState(false)
  const [savingType, setSavingType] = useState(false)

  // Grouped view toggle
  const [groupByParticipant, setGroupByParticipant] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => { fetchAll() }, [projectId])

  async function fetchAll() {
    setLoading(true)
    const [projectRes, docsRes, typesRes, participantsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("participant_documents")
        .select("*, document_type:document_types(id,name,required), participant:participants(id,first_name,last_name)")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false }),
      supabase.from("document_types").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("participants").select("id, first_name, last_name").eq("project_id", projectId).order("last_name"),
    ])
    setProject(projectRes.data)
    setDocs((docsRes.data ?? []) as unknown as DocWithParticipant[])
    setDocTypes(typesRes.data ?? [])
    setParticipants(participantsRes.data ?? [])
    setLoading(false)
  }

  const filtered = docs.filter(d => {
    if (filterType !== "all" && d.document_type_id !== filterType) return false
    if (filterParticipant !== "all" && d.participant_id !== filterParticipant) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const pName = `${d.participant?.first_name ?? ""} ${d.participant?.last_name ?? ""}`.toLowerCase()
      if (!d.name.toLowerCase().includes(q) && !pName.includes(q) && !(d.file_name ?? "").toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by participant
  const grouped = filtered.reduce((acc, doc) => {
    const pid = doc.participant_id
    if (!acc[pid]) acc[pid] = []
    acc[pid].push(doc)
    return acc
  }, {} as Record<string, DocWithParticipant[]>)

  function toggleCollapse(pid: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  async function handleUpload() {
    if (!newDoc.participant_id) { toast.error("Wybierz uczestnika."); return }
    if (!pendingFile) { toast.error("Wybierz plik."); return }
    setUploading(true)
    try {
      const storagePath = `${projectId}/${newDoc.participant_id}/${Date.now()}_${pendingFile.name}`
      const { error: upErr } = await supabase.storage
        .from("participant-documents")
        .upload(storagePath, pendingFile, { upsert: false })
      if (upErr) { toast.error("Błąd uploadu: " + upErr.message); return }

      const { data: urlData } = supabase.storage.from("participant-documents").getPublicUrl(storagePath)
      const docName = newDoc.name.trim() || pendingFile.name.replace(/\.[^/.]+$/, "")

      const { data: inserted, error: insErr } = await supabase
        .from("participant_documents")
        .insert({
          participant_id: newDoc.participant_id,
          project_id: projectId,
          document_type_id: newDoc.document_type_id || null,
          name: docName,
          file_url: urlData.publicUrl,
          file_name: pendingFile.name,
          file_size: pendingFile.size,
          mime_type: pendingFile.type,
          notes: newDoc.notes || null,
        })
        .select("*, document_type:document_types(id,name,required), participant:participants(id,first_name,last_name)")
        .single()

      if (insErr) { toast.error("Błąd zapisu: " + insErr.message); return }
      setDocs(prev => [inserted as unknown as DocWithParticipant, ...prev])
      setUploadDialog(false)
      setNewDoc({ participant_id: "", document_type_id: "", name: "", notes: "" })
      setPendingFile(null)
      toast.success("Dokument dodany!")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: DocWithParticipant) {
    if (!confirm(`Usunąć "${doc.name}"?`)) return
    if (doc.file_url) {
      const path = doc.file_url.split("/participant-documents/")[1]
      if (path) await supabase.storage.from("participant-documents").remove([path])
    }
    const { error } = await supabase.from("participant_documents").delete().eq("id", doc.id)
    if (error) { toast.error(error.message); return }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    toast.success("Usunięto.")
  }

  async function handleAddType() {
    if (!newTypeName.trim()) return
    setSavingType(true)
    const { data, error } = await supabase
      .from("document_types")
      .insert({ project_id: projectId, name: newTypeName.trim(), required: newTypeRequired, sort_order: docTypes.length })
      .select()
      .single()
    setSavingType(false)
    if (error) { toast.error(error.message); return }
    setDocTypes(prev => [...prev, data as DocumentType])
    setNewTypeName("")
    setNewTypeRequired(false)
    toast.success("Typ dodany!")
  }

  async function handleDeleteType(id: string) {
    if (!confirm("Usunąć ten typ? Dokumenty przypisane do tego typu zachowają się (bez kategorii).")) return
    const { error } = await supabase.from("document_types").delete().eq("id", id)
    if (error) { toast.error(error.message); return }
    setDocTypes(prev => prev.filter(t => t.id !== id))
    toast.success("Usunięto.")
  }

  function fileIcon(mimeType?: string | null) {
    if (!mimeType) return "📄"
    if (mimeType.includes("pdf")) return "📕"
    if (mimeType.includes("word") || mimeType.includes("docx")) return "📘"
    if (mimeType.includes("image")) return "🖼️"
    return "📄"
  }

  function formatSize(bytes?: number | null) {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const hasFilters = search.trim() || filterType !== "all" || filterParticipant !== "all"

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Dokumenty"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: project?.short_name ?? project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "Dokumenty" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Szukaj dokumentu / uczestnika..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 w-56 text-sm"
                />
              </div>

              {/* Filter type */}
              <Select value={filterType} onValueChange={v => setFilterType(v ?? "all")}>
                <SelectTrigger className="h-9 w-44 text-sm">
                  <SelectValue placeholder="Typ dokumentu..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie typy</SelectItem>
                  {docTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  <SelectItem value="">Bez kategorii</SelectItem>
                </SelectContent>
              </Select>

              {/* Filter participant */}
              <Select value={filterParticipant} onValueChange={v => setFilterParticipant(v ?? "all")}>
                <SelectTrigger className="h-9 w-48 text-sm">
                  <SelectValue placeholder="Uczestnik..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy uczestnicy</SelectItem>
                  {participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.last_name} {p.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-9 text-slate-400 hover:text-slate-700"
                  onClick={() => { setSearch(""); setFilterType("all"); setFilterParticipant("all") }}>
                  <X className="w-3.5 h-3.5 mr-1" />Wyczyść
                </Button>
              )}

              {/* Group toggle */}
              <button
                onClick={() => setGroupByParticipant(g => !g)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${groupByParticipant ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                Grupuj po uczestniku
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setTypesDialog(true)}>
                <Settings className="w-4 h-4 mr-1" />
                Typy dokumentów
              </Button>
              <Button size="sm" onClick={() => setUploadDialog(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj dokument
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span><span className="font-semibold text-slate-800">{filtered.length}</span> dokumentów</span>
            <span><span className="font-semibold text-slate-800">{Object.keys(grouped).length}</span> uczestników</span>
            {hasFilters && <span className="text-blue-600 text-xs">filtrowanie aktywne</span>}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium">Brak dokumentów</p>
                <p className="text-slate-400 text-sm mt-1">
                  {hasFilters ? "Zmień filtry lub" : "Zacznij od"} dodania pierwszego dokumentu.
                </p>
                <Button size="sm" className="mt-4" onClick={() => setUploadDialog(true)}>
                  <Plus className="w-4 h-4 mr-1" />Dodaj dokument
                </Button>
              </CardContent>
            </Card>
          ) : groupByParticipant ? (
            // Widok grupowany po uczestniku
            <div className="space-y-2">
              {Object.entries(grouped).map(([pid, pdocs]) => {
                const participant = pdocs[0]?.participant
                const isCollapsed = collapsed.has(pid)
                return (
                  <Card key={pid} className="overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => toggleCollapse(pid)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="font-medium text-slate-800 text-sm">
                          {participant ? `${participant.last_name} ${participant.first_name}` : "Nieznany uczestnik"}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {pdocs.length} {pdocs.length === 1 ? "dokument" : pdocs.length < 5 ? "dokumenty" : "dokumentów"}
                        </span>
                      </div>
                      {/* Required docs status */}
                      {docTypes.filter(t => t.required).length > 0 && (() => {
                        const required = docTypes.filter(t => t.required)
                        const have = required.filter(t => pdocs.some(d => d.document_type_id === t.id)).length
                        const all = required.length
                        return (
                          <span className={`text-xs font-medium ${have === all ? "text-green-600" : "text-amber-600"}`}>
                            {have}/{all} wymaganych
                          </span>
                        )
                      })()}
                    </button>
                    {!isCollapsed && (
                      <div className="border-t">
                        {pdocs.map(doc => (
                          <DocRow key={doc.id} doc={doc} onDelete={handleDelete} fileIcon={fileIcon} formatSize={formatSize} />
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          ) : (
            // Widok płaski
            <Card>
              <div className="divide-y">
                {filtered.map(doc => (
                  <DocRow key={doc.id} doc={doc} onDelete={handleDelete} fileIcon={fileIcon} formatSize={formatSize} showParticipant />
                ))}
              </div>
            </Card>
          )}
        </main>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadDialog} onOpenChange={open => { if (!open) { setUploadDialog(false); setPendingFile(null); setNewDoc({ participant_id: "", document_type_id: "", name: "", notes: "" }) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj dokument uczestnika</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Uczestnik *</Label>
              <Select value={newDoc.participant_id} onValueChange={v => setNewDoc(d => ({ ...d, participant_id: v ?? "" }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Wybierz uczestnika..." />
                </SelectTrigger>
                <SelectContent>
                  {participants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.last_name} {p.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ dokumentu</Label>
              <Select value={newDoc.document_type_id} onValueChange={v => setNewDoc(d => ({ ...d, document_type_id: v ?? "" }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="— bez kategorii —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Bez kategorii</SelectItem>
                  {docTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.required ? "* " : ""}{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nazwa dokumentu</Label>
              <Input
                placeholder="Domyślnie: nazwa pliku"
                value={newDoc.name}
                onChange={e => setNewDoc(d => ({ ...d, name: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Uwagi</Label>
              <Input
                placeholder="np. dostarczone 15.01.2026, scan oryginału"
                value={newDoc.notes}
                onChange={e => setNewDoc(d => ({ ...d, notes: e.target.value }))}
                className="text-sm"
              />
            </div>
            {/* File drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${pendingFile ? "border-green-400 bg-green-50" : "border-slate-300 hover:border-blue-400"}`}
              onClick={() => fileRef.current?.click()}
            >
              {pendingFile ? (
                <div className="text-green-700 text-sm">
                  <p className="font-medium">{pendingFile.name}</p>
                  <p className="text-xs text-green-600">{formatSize(pendingFile.size)}</p>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                  <p className="text-sm text-slate-600">Kliknij i wybierz plik</p>
                  <p className="text-xs text-slate-400 mt-0.5">PDF, DOC, DOCX, JPG, PNG</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => { setPendingFile(e.target.files?.[0] ?? null); e.target.value = "" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialog(false); setPendingFile(null) }}>Anuluj</Button>
            <Button onClick={handleUpload} disabled={uploading || !newDoc.participant_id || !pendingFile}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Types management dialog */}
      <Dialog open={typesDialog} onOpenChange={setTypesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Typy dokumentów projektu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              {docTypes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Brak zdefiniowanych typów</p>
              ) : (
                docTypes.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-white">
                    <div className="flex items-center gap-2">
                      {t.required && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">wymagany</span>}
                      <span className="text-sm text-slate-800">{t.name}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                      onClick={() => handleDeleteType(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            {/* Add new type */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">Dodaj nowy typ</p>
              <Input
                placeholder="Nazwa typu, np. Formularz rekrutacyjny"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                className="text-sm"
                onKeyDown={e => e.key === "Enter" && handleAddType()}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTypeRequired}
                  onChange={e => setNewTypeRequired(e.target.checked)}
                  className="rounded"
                />
                Wymagany dla uczestnika
              </label>
              <Button size="sm" onClick={handleAddType} disabled={savingType || !newTypeName.trim()} className="w-full">
                {savingType ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Dodaj typ
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypesDialog(false)}>Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Pomocniczy komponent wiersza dokumentu
function DocRow({
  doc,
  onDelete,
  fileIcon,
  formatSize,
  showParticipant = false,
}: {
  doc: DocWithParticipant
  onDelete: (doc: DocWithParticipant) => void
  fileIcon: (mime?: string | null) => string
  formatSize: (bytes?: number | null) => string
  showParticipant?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors">
      <span className="text-xl flex-shrink-0">{fileIcon(doc.mime_type)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800 truncate">{doc.name}</span>
          {doc.document_type && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">
              {doc.document_type.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
          {showParticipant && doc.participant && (
            <span className="text-slate-600 font-medium">
              {doc.participant.last_name} {doc.participant.first_name}
            </span>
          )}
          {doc.file_name && <span className="truncate max-w-40">{doc.file_name}</span>}
          {doc.file_size && <span>{formatSize(doc.file_size)}</span>}
          {doc.notes && <span className="italic">{doc.notes}</span>}
          <span>{new Date(doc.uploaded_at).toLocaleDateString("pl-PL")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600">
              <Download className="w-3.5 h-3.5" />
            </Button>
          </a>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
          onClick={() => onDelete(doc)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
