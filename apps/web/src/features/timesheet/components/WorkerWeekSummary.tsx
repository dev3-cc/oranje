import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  statusLight,
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { useApproveTimesheetMutation, useSubmitTimesheetMutation } from '../api/timesheetApi'
import type { TimesheetRow } from '../types/timesheet.types'

import { MagicCard } from '@/shared/components/MagicCard'
import {
  TIMESHEET_WEEK_STATUS_LABEL,
  TIMESHEET_WEEK_STATUS_TOKEN,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate, formatHours } from '@/shared/lib/formatters'

/**
 * «Quién sigue» de la pastilla (mismo patrón que el resto del proyecto): la
 * palabra sola no dice si a la persona le toca actuar o esperar.
 */
const WEEK_STATUS_DETAIL: Record<TimesheetWeekStatus, MessageDescriptor> = {
  OPEN: msg`Todavía se puede corregir y capturar marcas. El Supervisor la envía cuando esté lista.`,
  PENDING_APPROVAL: msg`El Supervisor ya la envió; ya no se puede editar. Falta que un Manager la apruebe.`,
  APPROVED: msg`Un Manager ya la aprobó. Sigue el pago y la factura del hotel.`,
}

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function weekActionErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      ANOMALIES_PENDING: i18n._(
        msg`Quedan días con anomalía sin resolver: revísalos antes de enviar la semana.`,
      ),
      TIMESHEET_NOT_OPEN: i18n._(msg`Esta semana ya se envió a aprobación: no admite más cambios.`),
      TIMESHEET_NOT_PENDING: i18n._(msg`Solo se aprueba una semana enviada a aprobación.`),
      DEPARTMENT_OUT_OF_SCOPE: i18n._(
        msg`Esta semana es de otro departamento: no te toca aprobarla.`,
      ),
    },
    byStatus: {
      403: i18n._(msg`Solo el Manager de Área o el Manager General pueden aprobar la semana.`),
    },
    fallback: i18n._(msg`No se pudo cambiar la semana. Inténtalo de nuevo.`),
  })
}

/**
 * Quiénes pueden aprobar la semana (D-09), como tooltip. Circulitos con el
 * monograma del ROL — el contrato de hoy no deja al Supervisor leer nombres ni
 * fotos de los managers de su hotel (403 en `/team` y en los usuarios del
 * hotel); cuando el back lo exponga, aquí van las caras reales.
 */
function ApproverTooltip({ children }: { children: ReactNode }): ReactNode {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-60">
          <p className="mb-1.5 text-xs font-semibold">
            <Trans>Aprueban la semana:</Trans>
          </p>
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-xs">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-o-500 text-[9px] font-bold text-ink">
                <Trans>MA</Trans>
              </span>
              <Trans>Manager de Área (su departamento)</Trans>
            </p>
            <p className="flex items-center gap-2 text-xs">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-o-500 text-[9px] font-bold text-ink">
                <Trans>MG</Trans>
              </span>
              <Trans>Manager General (cualquier departamento)</Trans>
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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
 */
export function WorkerWeekSummary({
  row,
  photoUrl = null,
  onManualPunch,
  onRequisitionHover,
}: {
  row: TimesheetRow
  /** Foto del colaborador; `null` = iniciales sobre naranja. */
  photoUrl?: string | null
  onManualPunch?: (row: TimesheetRow) => void
  /** Pasar el puntero por el badge de la requisición enciende su tramo de días. */
  onRequisitionHover?: (hovering: boolean) => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const [submitSheet, { isLoading: isSubmitting }] = useSubmitTimesheetMutation()
  const [approveSheet, { isLoading: isApproving }] = useApproveTimesheetMutation()
  const [actionError, setActionError] = useState<string | null>(null)
  const can = useCan()
  /** Aprobar es de los Managers (timesheet:approve_hours); el Supervisor envía y captura. */
  const canApprove = can('timesheet:approve_hours')

  /* Lo que el back rechazaría DESPUÉS se dice ANTES, en el botón (patrón
     honesto: deshabilitado con título). Enviar exige cero anomalías; capturar
     marcas exige una asignación ACTIVA — cerrada o cancelada, las horas son
     historia: se aprueban y pagan, pero ya no se captura. */
  const anomalies = row.entries.filter((entry) => entry.hasAnomaly).length
  const submitBlock =
    anomalies > 0
      ? t`${plural(anomalies, { one: '# día con anomalía', other: '# días con anomalía' })} por revisar: resuélvelos antes de enviar la semana`
      : null
  const manualPunchBlockDescriptor = manualPunchBlockOf(row.assignment)
  const manualPunchBlock =
    manualPunchBlockDescriptor === null ? null : i18n._(manualPunchBlockDescriptor)

  async function runAction(action: 'submit' | 'approve'): Promise<void> {
    setActionError(null)
    try {
      if (action === 'submit') {
        await submitSheet(row.timesheetId).unwrap()
        toast.success(t`Semana enviada a revisión`)
      } else {
        await approveSheet(row.timesheetId).unwrap()
        toast.success(t`Semana aprobada`)
      }
    } catch (error) {
      setActionError(weekActionErrorMessage(error, i18n))
    }
  }

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
              to={`/requisiciones/${row.requisitionId}`}
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

        {/* El ciclo completo de D-09 en la tarjeta: enviar (SUP) y aprobar (managers). */}
        <div className="flex flex-wrap gap-1.5">
          {row.weekStatus === 'OPEN' && (
            <>
              <button
                type="button"
                disabled={isSubmitting || submitBlock !== null}
                title={submitBlock ?? t`Mandar la semana a aprobación del Manager`}
                onClick={() => {
                  void runAction('submit')
                }}
                className={cn(
                  'cursor-pointer rounded-md bg-o-300 shadow-xs px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-o-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:opacity-60',
                  isSubmitting ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed',
                )}
              >
                {isSubmitting ? t`Enviando…` : t`Enviar a revisión`}
              </button>
              {onManualPunch !== undefined && (
                <button
                  type="button"
                  disabled={manualPunchBlock !== null}
                  title={
                    manualPunchBlock ?? t`Capturar una marca que el ponche no registró, con motivo`
                  }
                  onClick={() => {
                    onManualPunch(row)
                  }}
                  className="cursor-pointer rounded-md border border-line px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trans>Marca manual</Trans>
                </button>
              )}
            </>
          )}
          {row.weekStatus === 'PENDING_APPROVAL' &&
            (canApprove ? (
              <ApproverTooltip>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => {
                    void runAction('approve')
                  }}
                  className="cursor-pointer rounded-md bg-green px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-green/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-wait disabled:opacity-60"
                >
                  {isApproving ? t`Aprobando…` : t`Aprobar semana`}
                </button>
              </ApproverTooltip>
            ) : (
              <ApproverTooltip>
                <span className="max-w-full cursor-help truncate rounded-md border border-dashed border-line px-2 py-1 text-[10px] text-ink-3">
                  <Trans>Esperando aprobación</Trans>
                </span>
              </ApproverTooltip>
            ))}
        </div>

        {actionError !== null && (
          <p role="alert" className="rounded-md bg-red/10 px-2 py-1 text-xs font-medium text-red">
            {actionError}
          </p>
        )}
      </div>
    </MagicCard>
  )
}

/**
 * Por qué no se pueden capturar marcas; `null` si sí se puede (o el API no lo
 * dijo). Devuelve el descriptor: quien pinta lo traduce con `i18n._()` (D-36).
 */
function manualPunchBlockOf(assignment: TimesheetRow['assignment']): MessageDescriptor | null {
  if (assignment === undefined || assignment?.status === 'ACTIVE') return null
  if (assignment === null) {
    return msg`Sin asignación en esta requisición: no hay contra qué capturar marcas`
  }
  if (assignment.status === 'CANCELLED') {
    return msg`La asignación se canceló: las horas registradas se conservan, pero ya no se capturan marcas`
  }
  if (assignment.endsOn) {
    const endsOn = formatDate(assignment.endsOn)
    return msg`La asignación terminó el ${endsOn}: las horas se aprueban y pagan, pero ya no se capturan marcas`
  }
  return msg`La asignación terminó: las horas se aprueban y pagan, pero ya no se capturan marcas`
}
