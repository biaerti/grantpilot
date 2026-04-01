import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, differenceInDays } from "date-fns"
import { pl } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0,00 zł"
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: pl })
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return format(new Date(dateStr), "dd.MM.yyyy")
  } catch {
    return dateStr
  }
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: pl, addSuffix: true })
  } catch {
    return dateStr
  }
}

export function daysRemaining(endDate: string): number {
  return differenceInDays(new Date(endDate), new Date())
}

export function percentOf(value: number, total: number): number {
  if (!total) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

export function degurbaLabel(degurba: number | null | undefined): string {
  switch (degurba) {
    case 1: return "Miasto"
    case 2: return "Podmiejski"
    case 3: return "Wiejski"
    default: return "—"
  }
}

export function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    training: "Szkolenie",
    workshop: "Warsztat",
    conference: "Konferencja",
    consulting: "Konsultacja",
    production: "Produkcja",
    podcast: "Podcast",
    other: "Inne",
  }
  return labels[type] ?? type
}

export function eventStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Szkic",
    planned: "Zaplanowane",
    accepted: "Zatwierdzone",
    completed: "Zrealizowane",
    settled: "Rozliczone",
  }
  return labels[status] ?? status
}

export function projectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Aktywny",
    completed: "Zakończony",
    suspended: "Zawieszony",
  }
  return labels[status] ?? status
}

export function settlementStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Szkic",
    submitted: "Złożony",
    approved: "Zatwierdzony",
    rejected: "Odrzucony",
  }
  return labels[status] ?? status
}

export function accountingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Oczekuje",
    invoiced: "Zafakturowane",
    paid: "Opłacone",
  }
  return labels[status] ?? status
}

export function genderLabel(gender: string | null | undefined): string {
  if (gender === "K") return "Kobieta"
  if (gender === "M") return "Mężczyzna"
  return "—"
}

// Mobilization calculation:
// advance_received × 70% - already_settled = amount_needed
export function calculateMobilization(
  advanceReceived: number,
  alreadySettled: number
): number {
  return Math.max(0, advanceReceived * 0.7 - alreadySettled)
}

export function getProjectColor(index: number): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-yellow-500",
    "bg-red-500",
  ]
  return colors[index % colors.length]
}

export function getProjectHexColor(index: number): string {
  const colors = [
    "#3b82f6",
    "#22c55e",
    "#a855f7",
    "#f97316",
    "#ec4899",
    "#06b6d4",
    "#eab308",
    "#ef4444",
  ]
  return colors[index % colors.length]
}
