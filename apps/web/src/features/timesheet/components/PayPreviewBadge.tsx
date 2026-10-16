import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TimesheetPayPreview } from '../types/timesheet.types'

import { PendingAdjustmentsChip } from './PendingAdjustmentsChip'

import type { PayAdjustment } from '@/features/recruitment'
import { useCan } from '@/shared/hooks/useCan'
import { formatMoney } from '@/shared/lib/formatters'

/** Una píldora con tooltip — la misma forma para Pago y para Facturación,
    lista o no. */
function PreviewPill({
  icon,
  label,
  ready,
  children,
}: {
  icon: string
  label: string
  /** `true`: fondo lleno (hay un monto). `false`: punteada (falta un dato). */
  ready: boolean
  children: ReactNode
}): ReactNode {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex cursor-help items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold',
              ready
                ? 'bg-o-50 text-o-700'
                : 'border border-dashed border-line font-medium text-ink-3',
            )}
          >
            <MaterialIcon name={icon} className="text-sm" aria-hidden />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-72">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Lo que se le COBRA al hotel por esta hoja, junto a Horas netas — lo que
 * se le PAGA al colaborador ya no vive aquí: pasó a la columna Tarifa/h y al
 * Total de la semana, al pie de la tabla, sin tooltip de por medio (Hugo,
 * 2026-10-15, "quita pago estimado de arriba de la tabla"; la píldora
 * duplicaba ese mismo número escondido en un tooltip). `undefined` sin
 * `timesheet:read_all_hotels`: a nadie más se le dibuja nada.
 *
 * El margen (lo que se cobra vs. lo que se paga) es solo del Manager de
 * Contabilidad, no de la Contadora (Hugo, 2026-10-15: "esto solo muéstraselo
 * al jefe de Contabilidad"). El servidor ya le manda `billRate`/`billSubtotal`
 * en `null` si no tiene `payroll:view_margin` — pero `null` TAMBIÉN significa
 * "sin bill rate configurado", así que decidir aquí con el permiso real evita
 * mostrarle "Sin bill rate" a la Contadora, que sería mentirle: sí hay, solo
 * que no es para ella.
 */
export function PayPreviewBadge({
  payPreview,
  approvedAt = null,
  pendingAdjustments = [],
  isRecalculating = false,
}: {
  payPreview: TimesheetPayPreview | null | undefined
  /** Cuándo se aprobó la semana — para avisar si el contrato cambió
      DESPUÉS (Hugo, 2026-10-16): lo que se ve ya no es lo que se aprobó. */
  approvedAt?: string | null
  pendingAdjustments?: PayAdjustment[]
  /** Se está recalculando el lonche de este hotel: una píldora-skeleton en
      vez del número viejo, para no mostrar algo que ya no es cierto (Hugo,
      2026-10-15). */
  isRecalculating?: boolean
}): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const canViewMargin = can('payroll:view_margin')
  if (payPreview === undefined || payPreview === null) {
    return <PendingAdjustmentsChip adjustments={pendingAdjustments} />
  }

  /* El contrato se sigue editando aunque la semana ya esté aprobada (Hugo,
     2026-10-16: "si no ha cerrado tome el nuevo, pero que avise"). Esto SÍ
     cerró — approvedAt existe — y aun así el contrato se tocó después: lo
     que se ve arriba ya no es el número que el hotel/Manager aprobó. */
  const contractChangedAfterApproval =
    approvedAt !== null &&
    payPreview.contractUpdatedAt !== null &&
    new Date(payPreview.contractUpdatedAt) > new Date(approvedAt)

  if (isRecalculating) {
    return (
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-6 w-32 rounded-md" />
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contractChangedAfterApproval && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1.5 rounded-md border border-dashed border-yellow bg-yellow/10 px-2.5 py-1.5 text-xs font-semibold text-yellow">
                <MaterialIcon name="sync_problem" className="text-sm" aria-hidden />
                <Trans>Contrato cambió</Trans>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72">
              <Trans>
                El contrato se editó DESPUÉS de que esta semana ya se aprobó: lo que ves aquí es el
                cálculo nuevo, no el que se aprobó.
              </Trans>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* "Factura al hotel", no "Facturación" a secas — el nombre solo no
          decía A QUIÉN se le cobra (Hugo, 2026-10-15: "facturacion 168 que
          es?"). Es el bill rate del contrato × las horas, independiente de
          lo que Oranje le paga al colaborador por esas mismas horas. */}
      {canViewMargin &&
        (payPreview.billSubtotal !== null ? (
          <PreviewPill
            icon="receipt_long"
            label={t`Factura al hotel ${formatMoney(Number(payPreview.billSubtotal))}`}
            ready
          >
            <Trans>
              Lo que se le cobra al HOTEL por esta hoja, a{' '}
              {formatMoney(Number(payPreview.billRate))} la hora (bill rate del contrato) — no lo
              que recibe el colaborador.
            </Trans>
          </PreviewPill>
        ) : (
          <PreviewPill icon="receipt_long" label={t`Sin bill rate`} ready={false}>
            <Trans>
              El contrato no tiene tarifa de facturación para esta posición: no se calcula lo que se
              le cobraría al hotel.
            </Trans>
          </PreviewPill>
        ))}

      {/* Los gastos/ajustes YA incluidos — por semana, no por día (Hugo,
          2026-10-15: "los gastos extras, cómo los mostramos en cada día?").
          No hay a qué día pegarlos: un ajuste vive en la asignación, no
          tiene fecha propia en la base — ponerlo en un día concreto sería
          inventar uno. Nunca entra al "Pago del día" de ninguna fila; solo
          aquí y en el Total de abajo, que sí lo trae sumado. */}
      {payPreview.deductionAmount !== '0' && payPreview.deductionAmount !== '0.00' && (
        <PreviewPill
          icon="remove_circle"
          label={t`Ajustes incluidos -${formatMoney(Number(payPreview.deductionAmount))}`}
          ready
        >
          <Trans>
            Gastos/descuentos que Contabilidad ya decidió incluir en esta nómina — de toda la
            semana, no de un día en particular (el ajuste no tiene fecha propia). Ya están restados
            del Total de abajo.
          </Trans>
        </PreviewPill>
      )}

      <PendingAdjustmentsChip adjustments={pendingAdjustments} />
    </div>
  )
}
