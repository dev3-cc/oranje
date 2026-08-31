import { useState, type ReactNode } from 'react'

import { useApproveTimesheetMutation, useSubmitTimesheetMutation } from '../api/timesheetApi'
import type { TimesheetRow } from '../types/timesheet.types'

import {
  TIMESHEET_WEEK_STATUS_LABEL,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatHours } from '@/shared/lib/formatters'

/** Un dato de la fila: contorno tenue, sin color de estado. */
function Chip({ children, isPending }: { children: ReactNode; isPending?: boolean }): ReactNode {
  return (
    <span
      className={
        isPending === true
          ? 'inline-flex items-center rounded-md border border-dashed border-purple px-2.5 py-1 text-xs font-medium text-purple'
          : 'inline-flex items-center rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-3'
      }
    >
      {children}
    </span>
  )
}

/**
 * La columna fija de la izquierda: quién es, cuánto lleva y qué le falta.
 *
 * El total lo manda el backend sumado y NO se deriva de las celdas visibles: la
 * semana puede traer días fuera de la ventana, y una barra que cambia al hacer
 * scroll no sirve para nada.
 */
export function WorkerWeekSummary({
  row,
  onManualPunch,
}: {
  row: TimesheetRow
  onManualPunch?: (row: TimesheetRow) => void
}): ReactNode {
  const [submitSheet, { isLoading: isSubmitting }] = useSubmitTimesheetMutation()
  const [approveSheet, { isLoading: isApproving }] = useApproveTimesheetMutation()
  const [actionError, setActionError] = useState<string | null>(null)

  async function runAction(action: 'submit' | 'approve'): Promise<void> {
    setActionError(null)
    try {
      if (action === 'submit') await submitSheet(row.timesheetId).unwrap()
      else await approveSheet(row.timesheetId).unwrap()
    } catch (error) {
      setActionError(
        apiErrorMessage(error, {
          byCode: {
            ANOMALIES_PENDING:
              'Quedan días con anomalía sin resolver: revísalos antes de enviar la semana.',
            TIMESHEET_NOT_OPEN: 'Esta semana ya se envió a aprobación: no admite más cambios.',
            TIMESHEET_NOT_PENDING: 'Solo se aprueba una semana enviada a aprobación.',
            DEPARTMENT_OUT_OF_SCOPE: 'Esta semana es de otro departamento: no te toca aprobarla.',
          },
          byStatus: {
            403: 'Solo el Manager de Área o el Manager General pueden aprobar la semana.',
          },
          fallback: 'No se pudo cambiar la semana. Inténtalo de nuevo.',
        }),
      )
    }
  }

  /** Sin horas contractuales en el contrato, no hay barra que inventar. */
  const progress =
    row.targetHours !== null && row.targetHours > 0
      ? Math.min(1, row.totalHours / row.targetHours)
      : null

  return (
    <div className="flex gap-3">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-o-500 text-sm font-bold text-white"
        aria-hidden
      >
        {row.workerName.charAt(0)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-ink">{row.workerName}</p>
        <p className="truncate text-xs text-ink-3">{row.jobTitle}</p>

        <p className="mt-1 text-2xl font-bold text-ink">
          {formatHours(row.totalHours)}
          {row.targetHours !== null && (
            <span className="ml-1 text-sm font-normal text-ink-3">
              / {formatHours(row.targetHours)}
            </span>
          )}
        </p>

        {progress !== null && (
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
            role="img"
            aria-label={`${formatHours(row.totalHours)} de la meta`}
          >
            {progress > 0 && (
              <div
                className="h-full rounded-full bg-green"
                style={{ width: `${(progress * 100).toFixed(1)}%` }}
              />
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {/* El ciclo de D-09, tal cual viene: abierta, enviada o aprobada. */}
          <Chip isPending={row.weekStatus === 'PENDING_APPROVAL'}>
            {TIMESHEET_WEEK_STATUS_LABEL[row.weekStatus as TimesheetWeekStatus] ?? row.weekStatus}
          </Chip>
        </div>

        {/* El ciclo completo de D-09 en la fila: enviar (SUP) y aprobar (managers). */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.weekStatus === 'OPEN' && (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  void runAction('submit')
                }}
                className="cursor-pointer rounded-md bg-o-50 px-2.5 py-1 text-xs font-semibold text-o-700 transition-colors hover:bg-o-500/20 disabled:cursor-wait disabled:opacity-60"
              >
                {isSubmitting ? 'Enviando…' : 'Enviar a revisión'}
              </button>
              {onManualPunch !== undefined && (
                <button
                  type="button"
                  title="Capturar una marca que el ponche no registró, con motivo"
                  onClick={() => {
                    onManualPunch(row)
                  }}
                  className="cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  Marca manual
                </button>
              )}
            </>
          )}
          {row.weekStatus === 'PENDING_APPROVAL' && (
            <button
              type="button"
              disabled={isApproving}
              onClick={() => {
                void runAction('approve')
              }}
              className="cursor-pointer rounded-md bg-green/15 px-2.5 py-1 text-xs font-semibold text-ink-2 transition-colors hover:bg-green/25 disabled:cursor-wait disabled:opacity-60"
            >
              {isApproving ? 'Aprobando…' : 'Aprobar semana'}
            </button>
          )}
        </div>

        {actionError !== null && (
          <p role="alert" className="mt-1.5 text-xs text-red">
            {actionError}
          </p>
        )}
      </div>
    </div>
  )
}
