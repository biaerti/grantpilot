"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Building2, Users } from "lucide-react"
import type { UserProfile, Staff, Organization } from "@/lib/types"

export default function SettingsPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [profileForm, setProfileForm] = useState({ full_name: "", role: "coordinator" })
  const [newStaff, setNewStaff] = useState({ name: "", email: "", phone: "", role: "" })
  const [newOrg, setNewOrg] = useState({ name: "", nip: "", address: "", type: "own" })
  const [addingStaff, setAddingStaff] = useState(false)
  const [addingOrg, setAddingOrg] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, staffRes, orgsRes] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", user.id).single(),
      supabase.from("staff").select("*").order("name"),
      supabase.from("organizations").select("*").order("name"),
    ])

    if (profileRes.data) {
      setProfile(profileRes.data)
      setProfileForm({ full_name: profileRes.data.full_name ?? "", role: profileRes.data.role })
    }
    setStaff(staffRes.data ?? [])
    setOrganizations(orgsRes.data ?? [])
    setLoading(false)
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from("user_profiles")
      .update({ full_name: profileForm.full_name, role: profileForm.role })
      .eq("id", profile.id)
    setSaving(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    toast.success("Profil zapisany!")
    setProfile((p) => p ? { ...p, full_name: profileForm.full_name, role: profileForm.role as UserProfile["role"] } : null)
  }

  const handleAddStaff = async () => {
    if (!newStaff.name) { toast.error("Podaj imię i nazwisko."); return }
    setAddingStaff(true)
    const { data, error } = await supabase
      .from("staff")
      .insert({ name: newStaff.name, email: newStaff.email || null, phone: newStaff.phone || null, role: newStaff.role || null })
      .select()
      .single()
    setAddingStaff(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setStaff((prev) => [...prev, data])
    setNewStaff({ name: "", email: "", phone: "", role: "" })
    toast.success("Osoba dodana!")
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Usunąć tę osobę?")) return
    await supabase.from("staff").delete().eq("id", id)
    setStaff((prev) => prev.filter((s) => s.id !== id))
    toast.success("Usunięto.")
  }

  const handleAddOrg = async () => {
    if (!newOrg.name) { toast.error("Podaj nazwę organizacji."); return }
    setAddingOrg(true)
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: newOrg.name, nip: newOrg.nip || null, address: newOrg.address || null, type: newOrg.type })
      .select()
      .single()
    setAddingOrg(false)
    if (error) { toast.error("Błąd: " + error.message); return }
    setOrganizations((prev) => [...prev, data])
    setNewOrg({ name: "", nip: "", address: "", type: "own" })
    toast.success("Podmiot dodany!")
  }

  const handleDeleteOrg = async (id: string) => {
    if (!confirm("Usunąć ten podmiot?")) return
    await supabase.from("organizations").delete().eq("id", id)
    setOrganizations((prev) => prev.filter((o) => o.id !== id))
    toast.success("Usunięto.")
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header title="Ustawienia" />
        <main className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Profil</TabsTrigger>
              <TabsTrigger value="staff">Personel</TabsTrigger>
              <TabsTrigger value="organizations">Podmioty</TabsTrigger>
            </TabsList>

            {/* Profile */}
            <TabsContent value="profile" className="mt-6">
              <Card className="max-w-lg">
                <CardHeader>
                  <CardTitle>Mój profil</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Imię i nazwisko</Label>
                    <Input
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rola</Label>
                    <Select value={profileForm.role} onValueChange={(v) => setProfileForm((p) => ({ ...p, role: v ?? "coordinator" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coordinator">Koordynator</SelectItem>
                        <SelectItem value="accountant">Księgowa</SelectItem>
                        <SelectItem value="manager">Kierownik</SelectItem>
                        <SelectItem value="viewer">Podgląd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Zapisz profil
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Staff */}
            <TabsContent value="staff" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Personel projektowy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <p className="text-sm font-medium text-slate-700">Dodaj osobę</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Imię i nazwisko *"
                        value={newStaff.name}
                        onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))}
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="Rola (psycholog, trener...)"
                        value={newStaff.role}
                        onChange={(e) => setNewStaff((p) => ({ ...p, role: e.target.value }))}
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="Email"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))}
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="Telefon"
                        value={newStaff.phone}
                        onChange={(e) => setNewStaff((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <Button size="sm" onClick={handleAddStaff} disabled={addingStaff}>
                      {addingStaff ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                      Dodaj
                    </Button>
                  </div>

                  {/* List */}
                  {loading ? (
                    <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
                  ) : staff.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Brak personelu w bazie.</p>
                  ) : (
                    <div className="space-y-2">
                      {staff.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">{s.name}</p>
                            <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                              {s.role && <span>{s.role}</span>}
                              {s.email && <span>{s.email}</span>}
                              {s.phone && <span>{s.phone}</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-600"
                            onClick={() => handleDeleteStaff(s.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Organizations */}
            <TabsContent value="organizations" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Podmioty (liderzy, realizatorzy)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new */}
                  <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <p className="text-sm font-medium text-slate-700">Dodaj podmiot</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        className="h-8 text-sm col-span-2"
                        placeholder="Nazwa *"
                        value={newOrg.name}
                        onChange={(e) => setNewOrg((p) => ({ ...p, name: e.target.value }))}
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="NIP"
                        value={newOrg.nip}
                        onChange={(e) => setNewOrg((p) => ({ ...p, nip: e.target.value }))}
                      />
                      <Select value={newOrg.type} onValueChange={(v) => setNewOrg((p) => ({ ...p, type: v ?? "own" }))}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">Własny (Pretium/Educandis)</SelectItem>
                          <SelectItem value="external">Zewnętrzny</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-8 text-sm col-span-2"
                        placeholder="Adres"
                        value={newOrg.address}
                        onChange={(e) => setNewOrg((p) => ({ ...p, address: e.target.value }))}
                      />
                    </div>
                    <Button size="sm" onClick={handleAddOrg} disabled={addingOrg}>
                      {addingOrg ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                      Dodaj
                    </Button>
                  </div>

                  {/* List */}
                  {organizations.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Brak podmiotów w bazie.</p>
                  ) : (
                    <div className="space-y-2">
                      {organizations.map((org) => (
                        <div key={org.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <div>
                            <p className="font-medium text-slate-900">{org.name}</p>
                            <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                              {org.nip && <span>NIP: {org.nip}</span>}
                              <span className={org.type === "own" ? "text-blue-600" : "text-slate-500"}>
                                {org.type === "own" ? "Własny" : "Zewnętrzny"}
                              </span>
                              {org.address && <span>{org.address}</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-600"
                            onClick={() => handleDeleteOrg(org.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
