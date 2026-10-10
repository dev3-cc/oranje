import { useLingui } from '@lingui/react/macro'
import { cn, statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'

import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
  URGENCY_HINT,
  URGENCY_LABEL,
  URGENCY_TOKEN,
  type RequisitionStatus,
  type UrgencyLevel,
} from '@/shared/constants/requisitionStatus'

/** El semáforo de la requisición, con los mismos colores y nombres que el web. */
export function RequisitionStatusChip({ status }: { status: RequisitionStatus }): ReactNode {
  return (
    <StatusLightSoftBadge
      token={REQUISITION_STATUS_TOKEN[status]}
      label={REQUISITION_STATUS_LABEL[status]}
    />
  )
}

/** Urgente · Medio · Normal; el umbral, en el `title`. */
export function UrgencyChip({ urgency }: { urgency: UrgencyLevel }): ReactNode {
  return (
    <span
      title={URGENCY_HINT[urgency]}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2"
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: statusLight[URGENCY_TOKEN[urgency]] }}
      />
      {URGENCY_LABEL[urgency]}
    </span>
  )
}

/** Cuántos lugares están cubiertos: barra y «3/5». */
export function CoverageBar({
  filled,
  total,
  className,
}: {
  filled: number
  total: number
  className?: string
}): ReactNode {
  const { t } = useLingui()
  const ratio = total === 0 ? 0 : Math.min(filled / total, 1)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={t`Cobertura`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn('h-full rounded-full', ratio === 1 ? 'bg-green' : 'bg-o-500')}
          style={{ width: `${String(Math.round(ratio * 100))}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-ink-2 tabular-nums">
        {filled}/{total}
      </span>
    </div>
  )
}
