"use client"

import { Progress } from "@/components/ui/progress"
import { formatCurrency, percentOf } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface BudgetProgressProps {
  label?: string
  planned: number
  spent: number
  showIndirect?: boolean
  indirectRate?: number
  compact?: boolean
}

export function BudgetProgress({
  label,
  planned,
  spent,
  showIndirect = false,
  indirectRate = 0.2,
  compact = false,
}: BudgetProgressProps) {
  const percent = percentOf(spent, planned)
  const remaining = planned - spent
  const isOverBudget = spent > planned
  const isWarning = percent >= 80

  const indirectPlanned = planned * indirectRate
  const indirectSpent = spent * indirectRate
  const totalPlanned = planned + indirectPlanned
  const totalSpent = spent + indirectSpent

  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      {label && (
        <div className="flex justify-between items-center">
          <span className={cn("font-medium text-slate-700", compact ? "text-xs" : "text-sm")}>
            {label}
          </span>
          <span className={cn(
            "font-semibold",
            compact ? "text-xs" : "text-sm",
            isOverBudget ? "text-red-600" : isWarning ? "text-amber-600" : "text-slate-600"
          )}>
            {percent}%
          </span>
        </div>
      )}

      <Progress
        value={percent}
        className={cn(
          compact ? "h-1.5" : "h-2",
          isOverBudget
            ? "[&>div]:bg-red-500"
            : isWarning
            ? "[&>div]:bg-amber-500"
            : "[&>div]:bg-blue-500"
        )}
      />

      <div className={cn(
        "flex justify-between text-slate-500",
        compact ? "text-xs" : "text-sm"
      )}>
        <span>
          Wydano: <span className={cn("font-medium", isOverBudget ? "text-red-600" : "text-slate-700")}>
            {formatCurrency(spent)}
          </span>
        </span>
        <span>
          Pozostało: <span className={cn("font-medium", remaining < 0 ? "text-red-600" : "text-slate-700")}>
            {formatCurrency(remaining)}
          </span>
        </span>
      </div>

      {showIndirect && (
        <div className={cn(
          "pt-2 mt-2 border-t border-slate-100 space-y-1",
          compact ? "text-xs" : "text-sm"
        )}>
          <div className="flex justify-between text-slate-500">
            <span>Bezpośrednie:</span>
            <span className="font-medium">{formatCurrency(planned)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Pośrednie ({Math.round(indirectRate * 100)}%):</span>
            <span className="font-medium">{formatCurrency(indirectPlanned)}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-700">
            <span>RAZEM:</span>
            <span>{formatCurrency(totalPlanned)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
