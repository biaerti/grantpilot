"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ArrowLeft, Plus, Trash2, Loader2, Building2, Pencil, X, Check } from "lucide-react"
import Link from "next/link"

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

const DEFAULT_CONTRACTORS = ["Ceduro", "BIT Finanse Sp. z o.o.", "Educandis"]

export default function ContractorsPage() {
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const supabase = createClient()

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const emptyForm = { name: "", nip: "", email: "", phone: "", address: "", notes: "" }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchContractors() }, [projectId])

  async function fetchContractors() {
    const { data } = await supabase
      .from("contractors")
      .select("*")
      .eq("project_id", projectId)
      .order("name")
    setContractors(data ?? [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Podaj nazwę wykonawcy."); return }
    setSaving(true)
    if (editingId) {
      const { error } = await supabase.from("contractors").update({
        name: form.name,
        nip: form.nip || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      }).eq("id", editingId)
      if (error) { toast.error("Błąd: " + error.message); setSaving(false); return }
      setContractors(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c))
      toast.success("Zapisano.")
      setEditingId(null)
    } else {
      const { data, error } = await supabase.from("contractors").insert({
        project_id: projectId,
        name: form.name,
        nip: form.nip || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      }).select().single()
      if (error) { toast.error("Błąd: " + error.message); setSaving(false); return }
      setContractors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success("Wykonawca dodany!")
      setShowForm(false)
    }
    setForm(emptyForm)
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć wykonawcę "${name}"?`)) return
    const { error } = await supabase.from("contractors").delete().eq("id", id)
    if (error) { toast.error("Błąd: " + error.message); return }
    setContractors(prev => prev.filter(c => c.id !== id))
    toast.success("Usunięto.")
  }

  const startEdit = (c: Contractor) => {
    setEditingId(c.id)
    setForm({ name: c.name, nip: c.nip ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" })
    setShowForm(false)
  }

  const addDefaultContractor = async (name: string) => {
    const { data, error } = await supabase.from("contractors").insert({
      project_id: projectId, name,
    }).select().single()
    if (error) { toast.error("Błąd: " + error.message); return }
    setContractors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    toast.success(`"${name}" dodany!`)
  }

  const missingDefaults = DEFAULT_CONTRACTORS.filter(d => !contractors.some(c => c.name === d))

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Wykonawcy"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Projekt", href: `/projects/${projectId}` },
            { label: "Wykonawcy" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" />
              Wróć do projektu
            </Link>
            <div className="flex gap-2">
              <Link href={`/projects/${projectId}/contracts`}>
                <Button variant="outline" size="sm">Umowy</Button>
              </Link>
              <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj wykonawcę
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

          {/* Add form */}
          {showForm && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nowy wykonawca</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Nazwa *</Label>
                    <Input placeholder="Np. Ceduro Sp. z o.o." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NIP</Label>
                    <Input placeholder="0000000000" value={form.nip} onChange={e => setForm(p => ({ ...p, nip: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefon</Label>
                    <Input placeholder="+48 000 000 000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input placeholder="kontakt@firma.pl" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Adres</Label>
                    <Input placeholder="ul. Przykładowa 1, 00-000 Miasto" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Notatki</Label>
                    <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Zapisz
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Anuluj</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* List */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" /></div>
          ) : contractors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                <p>Brak wykonawców. Dodaj pierwszego lub skorzystaj z szybkiego dodawania powyżej.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {contractors.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    {editingId === c.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Nazwa *</Label>
                            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">NIP</Label>
                            <Input value={form.nip} onChange={e => setForm(p => ({ ...p, nip: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Telefon</Label>
                            <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Email</Label>
                            <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Adres</Label>
                            <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Notatki</Label>
                            <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSave} disabled={saving}>
                            <Check className="w-3.5 h-3.5 mr-1" />Zapisz
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5 mr-1" />Anuluj
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Building2 className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-900">{c.name}</p>
                            <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                              {c.nip && <span>NIP: {c.nip}</span>}
                              {c.email && <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline">{c.email}</a>}
                              {c.phone && <span>{c.phone}</span>}
                              {c.address && <span>{c.address}</span>}
                            </div>
                            {c.notes && <p className="text-xs text-slate-400 mt-1">{c.notes}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(c)}>
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(c.id, c.name)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
