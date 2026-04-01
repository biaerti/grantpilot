"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    project_number: "",
    name: "",
    short_name: "",
    start_date: "",
    end_date: "",
    total_budget: "",
    grant_amount: "",
    grant_rate: "0.85",
    advance_received: "0",
    indirect_cost_rate: "0.20",
    is_subcontractor: "false",
    status: "active",
    notes: "",
  })

  const handleChange = (field: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.project_number || !form.name || !form.start_date || !form.end_date) {
      toast.error("Wypełnij wymagane pola.")
      return
    }
    setSaving(true)

    const { data, error } = await supabase
      .from("projects")
      .insert({
        project_number: form.project_number,
        name: form.name,
        short_name: form.short_name || null,
        start_date: form.start_date,
        end_date: form.end_date,
        total_budget: form.total_budget ? parseFloat(form.total_budget) : null,
        grant_amount: form.grant_amount ? parseFloat(form.grant_amount) : null,
        grant_rate: form.grant_rate ? parseFloat(form.grant_rate) : null,
        advance_received: parseFloat(form.advance_received) || 0,
        indirect_cost_rate: parseFloat(form.indirect_cost_rate) || 0.2,
        is_subcontractor: form.is_subcontractor === "true",
        status: form.status,
        notes: form.notes || null,
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      toast.error("Nie udało się zapisać projektu: " + error.message)
      return
    }

    toast.success("Projekt utworzony!")
    router.push(`/projects/${data.id}`)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <Header
          title="Nowy projekt"
          breadcrumbs={[
            { label: "Projekty", href: "/projects" },
            { label: "Nowy projekt" },
          ]}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
              <ArrowLeft className="w-4 h-4" />
              Wróć do projektów
            </Link>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Podstawowe informacje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="project_number">Numer projektu *</Label>
                      <Input
                        id="project_number"
                        placeholder="FEDS.07.03-IP.02-0039/25"
                        value={form.project_number}
                        onChange={(e) => handleChange("project_number", e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="name">Pełna nazwa projektu *</Label>
                      <Input
                        id="name"
                        placeholder="Równość na co dzień – przeciwdziałanie dyskryminacji"
                        value={form.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="short_name">Krótka nazwa (opcjonalna)</Label>
                      <Input
                        id="short_name"
                        placeholder="Równość na co dzień"
                        value={form.short_name}
                        onChange={(e) => handleChange("short_name", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Data rozpoczęcia *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={form.start_date}
                        onChange={(e) => handleChange("start_date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">Data zakończenia *</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={form.end_date}
                        onChange={(e) => handleChange("end_date", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Aktywny</SelectItem>
                          <SelectItem value="completed">Zakończony</SelectItem>
                          <SelectItem value="suspended">Zawieszony</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="is_subcontractor">Rola</Label>
                      <Select value={form.is_subcontractor} onValueChange={(v) => handleChange("is_subcontractor", v)}>
                        <SelectTrigger id="is_subcontractor">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">Lider projektu</SelectItem>
                          <SelectItem value="true">Podwykonawca</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Budżet i dofinansowanie</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="total_budget">Budżet całkowity (zł)</Label>
                      <Input
                        id="total_budget"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={form.total_budget}
                        onChange={(e) => handleChange("total_budget", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grant_amount">Kwota dofinansowania (zł)</Label>
                      <Input
                        id="grant_amount"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={form.grant_amount}
                        onChange={(e) => handleChange("grant_amount", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grant_rate">Poziom dofinansowania (%)</Label>
                      <Input
                        id="grant_rate"
                        type="number"
                        placeholder="0.85"
                        step="0.01"
                        min="0"
                        max="1"
                        value={form.grant_rate}
                        onChange={(e) => handleChange("grant_rate", e.target.value)}
                      />
                      <p className="text-xs text-slate-500">Np. 0.85 = 85%</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="advance_received">Zaliczka otrzymana (zł)</Label>
                      <Input
                        id="advance_received"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={form.advance_received}
                        onChange={(e) => handleChange("advance_received", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="indirect_cost_rate">Stawka kosztów pośrednich</Label>
                      <Input
                        id="indirect_cost_rate"
                        type="number"
                        placeholder="0.20"
                        step="0.01"
                        min="0"
                        max="1"
                        value={form.indirect_cost_rate}
                        onChange={(e) => handleChange("indirect_cost_rate", e.target.value)}
                      />
                      <p className="text-xs text-slate-500">Np. 0.20 = 20%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notatki</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Dodatkowe informacje o projekcie..."
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Zapisuję...
                    </>
                  ) : (
                    "Utwórz projekt"
                  )}
                </Button>
                <Link href="/projects">
                  <Button type="button" variant="outline">Anuluj</Button>
                </Link>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
