import { Badge } from "@/components/ui/badge"
import { eventStatusLabel } from "@/lib/utils"
import type { EventStatus } from "@/lib/types"

interface EventStatusBadgeProps {
  status: EventStatus
}

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const variants: Record<EventStatus, { className: string }> = {
    draft: { className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
    planned: { className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
    accepted: { className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
    completed: { className: "bg-green-100 text-green-700 hover:bg-green-100" },
    settled: { className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  }

  return (
    <Badge className={variants[status]?.className ?? ""}>
      {eventStatusLabel(status)}
    </Badge>
  )
}
