import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import {
  MaterialIcon,
  statusLight,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { TimesheetRow } from '../types/timesheet.types'

import { WeekActionBar } from './WeekActionBar'

import { MagicCard } from '@/shared/components/MagicCard'
import {
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUS_TOKEN,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'
import { formatHours } from '@/shared/lib/formatters'

/**
 * «Quién sigue» de la pastilla (mismo patrón que el resto del proyecto): la
 * palabra sola no dice si a la persona le toca actuar o esperar.
 */
const WEEK_STATUS_DETAIL: Record<TimesheetWeekStatus, MessageDescriptor> = {
  OPEN: msg`Todavía se puede corregir y capturar marcas. El Supervisor la envía cuando esté lista.`,
  PENDING_APPROVAL: msg`El Supervisor ya la envió; ya no se puede editar. Falta que un Manager la apruebe.`,
  APPROVED: msg`Un Manager ya la aprobó. Sigue el pago y la factura del hotel.`,
}

/**
 * La columna fija de la izquierda como ficha clara: foto pequeña, nombre,
 * puesto y hotel como subtítulo, y los datos (horas, estado) como texto
 * discreto con un punto de color — el mismo lenguaje que ya usa la celda del
 * día — en vez de una pastilla saturada. La foto del hotel de fondo se quitó
 * de ESTA tarjeta (Hugo: "no me gusta cómo se ve"); el Perfil del Colaborador
 * y el hero de Revisión del día la conservan, es una decisión puntual de esta
 * ficha, no un cambio de patrón general.
 *
 * El total lo manda el backend sumado y NO se deriva de las celdas visibles:
 * la semana puede traer días fuera de la ventana.
 *
 * Lleva el Magic Bento (`MagicCard`) que ya es el acento de toda fila de
 * persona o cliente en el resto de la app (Pool, Mi Personal, Mi Equipo,
 * requisiciones…) — a esta tarjeta le faltaba.
 *
 * El ciclo enviar/aprobar/marca manual vive en `WeekActionBar` — factorizado
 * (Hugo, 2026-10-10) para poder repetirse también junto a la tabla de días
 * sin dos copias del mismo `runAction`.
 */
export function WorkerWeekSummary({
  row,
  photoUrl = null,
  onManualPunch,
  onRequisitionHover,
  showActions = true,
}: {
  row: TimesheetRow
  /** Foto del colaborador; `null` = iniciales sobre naranja. */
  photoUrl?: string | null
  onManualPunch?: ((row: TimesheetRow) => void) | undefined
  /** Pasar el puntero por el badge de la requisición enciende su tramo de días. */
  onRequisitionHover?: (hovering: boolean) => void
  /** `false` cuando el `WeekActionBar` ya vive en otro lado de la misma
      pantalla (la tabla de días en Asistencia, Hugo 2026-10-10) — un solo
      lugar con el botón, no dos copias repitiendo la misma acción. */
  showActions?: boolean
}): ReactNode {
  const { t, i18n } = useLingui()

  /** Sin horas contractuales en el contrato, no hay barra que inventar. */
  const progress =
    row.targetHours !== null && row.targetHours > 0
      ? Math.min(1, row.totalHours / row.targetHours)
      : null

  const requisitionRef = row.entries[0]?.requisitionNumber ?? null

  const weekStatusColor =
    statusLight[TIMESHEET_WEEK_STATUS_TOKEN[row.weekStatus as TimesheetWeekStatus]]

  return (
    <MagicCard className="rounded-xl">
      <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3">
        {/* La foto pequeña a la izquierda; nombre, puesto y hotel como subtítulo
            (patrón de tarjeta de perfil clara, no el hero con foto de hotel). */}
        <div className="flex items-start gap-2.5">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="size-11 shrink-0 rounded-xl object-cover ring-1 ring-line"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-o-500 text-base font-bold text-ink ring-1 ring-line"
            >
              {row.workerName.charAt(0)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{row.workerName}</p>
            <p className="truncate text-xs text-ink-3">
              {row.jobTitle} · {row.hotelName}
            </p>
          </div>
        </div>

        {/* Las cifras como texto discreto con un punto de color — el mismo
            lenguaje que ya usa `TimesheetDayCell` para su estado — en vez de
            pastillas saturadas de lado a lado. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
            <MaterialIcon name="schedule" className="text-sm text-ink-3" aria-hidden />
            {formatHours(row.totalHours)}
            {row.targetHours !== null && (
              <span className="font-normal text-ink-3">/ {formatHours(row.targetHours)}</span>
            )}
          </span>

          {/* El ciclo de D-09: abierta → enviada → aprobada. La palabra sola no
              dice quién sigue: el tooltip lo explica (patrón del resto del
              proyecto). */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help items-center gap-1 font-semibold text-ink-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: weekStatusColor }}
                    aria-hidden
                  />
                  {TIMESHEET_WEEK_STATUS_LABEL[row.weekStatus as TimesheetWeekStatus] ??
                    row.weekStatus}
                  <MaterialIcon name="info" className="text-sm text-ink-4" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56">
                <p className="text-xs">
                  {WEEK_STATUS_DETAIL[row.weekStatus as TimesheetWeekStatus]
                    ? i18n._(WEEK_STATUS_DETAIL[row.weekStatus as TimesheetWeekStatus])
                    : t`Estado de la semana.`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Un timesheet ES una requisición por semana. El badge es discreto y
              ABRE la requisición. */}
          {requisitionRef !== null && (
            <Link
              to={`/requisitions/${row.requisitionId}`}
              title={t`Abrir la requisición`}
              onMouseEnter={() => onRequisitionHover?.(true)}
              onMouseLeave={() => onRequisitionHover?.(false)}
              onFocus={() => onRequisitionHover?.(true)}
              onBlur={() => onRequisitionHover?.(false)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-semibold text-ink-2 transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              <MaterialIcon name="assignment" className="text-sm" aria-hidden />
              {requisitionRef}
              <MaterialIcon name="chevron_right" className="text-sm" aria-hidden />
            </Link>
          )}
        </div>

        {progress !== null && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-3"
            role="img"
            aria-label={t`${formatHours(row.totalHours)} de la meta`}
          >
            {progress > 0 && (
              <div
                className="h-full rounded-full bg-o-500"
                style={{ width: `${(progress * 100).toFixed(1)}%` }}
              />
            )}
          </div>
        )}

        {showActions && <WeekActionBar row={row} onManualPunch={onManualPunch} />}
      </div>
    </MagicCard>
  )
}
