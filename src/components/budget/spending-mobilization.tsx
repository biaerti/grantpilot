"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatCurrency, calculateMobilization } from "@/lib/utils"
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"

interface SpendingMobilizationProps {
  advanceReceived: number
  alreadySettled: number
  projectName?: string
}

export function SpendingMobilization({
  advanceReceived,
  alreadySettled,
  projectName,
}: SpendingMobilizationProps) {
  const mobilization = calculateMobilization(advanceReceived, alreadySettled)
  const target = advanceReceived * 0.7
  const isOk = alreadySettled >= target

  if (advanceReceived === 0) return null

  return (
    <Alert className={isOk ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
      {isOk ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle className={isOk ? "text-green-800" : "text-amber-800"}>
        Mobilizacja wydatków {projectName && `– ${projectName}`}
      </AlertTitle>
      <AlertDescription className={isOk ? "text-green-700" : "text-amber-700"}>
        <div className="mt-1 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Zaliczka otrzymana:</span>
            <span className="font-medium">{formatCurrency(advanceReceived)}</span>
          </div>
          <div className="flex justify-between">
            <span>Próg rozliczenia (70%):</span>
            <span className="font-medium">{formatCurrency(target)}</span>
          </div>
          <div className="flex justify-between">
            <span>Już rozliczono:</span>
            <span className="font-medium">{formatCurrency(alreadySettled)}</span>
          </div>
          {isOk ? (
            <div className="flex justify-between font-semibold text-green-800">
              <span>Nadwyżka:</span>
              <span>+{formatCurrency(alreadySettled - target)}</span>
            </div>
          ) : (
            <div className="flex justify-between font-semibold text-amber-800 border-t border-amber-200 pt-1">
              <span>Do rozliczenia brakuje:</span>
              <span>{formatCurrency(mobilization)}</span>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
