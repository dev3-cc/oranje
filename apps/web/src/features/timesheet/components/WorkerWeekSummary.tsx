import {
  cn,
  MaterialIcon,
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

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import {
  TIMESHEET_WEEK_STATUS_LABEL,
  type TimesheetWeekStatus,
} from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatHours } from '@/shared/lib/formatters'

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
          <p className="mb-1.5 text-xs font-semibold">Aprueban la semana:</p>
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-xs">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-o-500 text-[9px] font-bold text-ink">
                MA
              </span>
              Manager de Área (su departamento)
            </p>
            <p className="flex items-center gap-2 text-xs">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-o-500 text-[9px] font-bold text-ink">
                MG
              </span>
              Manager General (cualquier departamento)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Una pastilla de dato sobre el vidrio oscuro. */
function Pill({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
        className ?? 'bg-white/15 text-white',
      )}
    >
      {children}
    </span>
  )
}

/**
 * La columna fija de la izquierda como tarjeta con identidad: la foto del
 * hotel de fondo bajo un vidrio oscuro (el patrón del Perfil del Colaborador),
 * la foto de la persona en grande y los datos como pastillas. El texto va en
 * blanco sobre `ink` — la foto ambienta, nunca compite con la lectura.
 *
 * El total lo manda el backend sumado y NO se deriva de las celdas visibles:
 * la semana puede traer días fuera de la ventana.
 */
export function WorkerWeekSummary({
  row,
  photoUrl = null,
  hotelPhotoUrl = null,
  onManualPunch,
  onRequisitionHover,
}: {
  row: TimesheetRow
  /** Foto del colaborador; `null` = iniciales sobre naranja. */
  photoUrl?: string | null
  /** Foto del hotel para el fondo; `null` = placeholder de marca. */
  hotelPhotoUrl?: string | null
  onManualPunch?: (row: TimesheetRow) => void
  /** Pasar el puntero por el badge de la requisición enciende su tramo de días. */
  onRequisitionHover?: (hovering: boolean) => void
}): ReactNode {
  const [submitSheet, { isLoading: isSubmitting }] = useSubmitTimesheetMutation()
  const [approveSheet, { isLoading: isApproving }] = useApproveTimesheetMutation()
  const [actionError, setActionError] = useState<string | null>(null)
  const can = useCan()
  /** Aprobar es de los Managers (timesheet:approve_hours); el Supervisor envía y captura. */
  const canApprove = can('timesheet:approve_hours')

  async function runAction(action: 'submit' | 'approve'): Promise<void> {
    setActionError(null)
    try {
      if (action === 'submit') {
        await submitSheet(row.timesheetId).unwrap()
        toast.success('Semana enviada a revisión')
      } else {
        await approveSheet(row.timesheetId).unwrap()
        toast.success('Semana aprobada')
      }
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

  const requisitionRef = row.entries[0]?.requisitionNumber ?? null

  return (
    <div className="relative overflow-hidden rounded-xl">
      <HotelPhotoBackdrop photoUrl={hotelPhotoUrl} />
      {/* El cristal negro en degradado: arriba se asoma el hotel, abajo manda
          el texto — mismo efecto que las tarjetas del Perfil del Colaborador. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-ink/45 via-ink/65 to-ink/85"
      />

      <div className="relative flex flex-col gap-2 p-2.5">
        {/* La foto grande a la izquierda; la info a su derecha (patrón ficha). */}
        <div className="flex items-center gap-2.5">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-white/60"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-o-500 text-xl font-bold text-ink ring-1 ring-white/60"
            >
              {row.workerName.charAt(0)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{row.workerName}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
              <MaterialIcon name="schedule" className="text-sm" aria-hidden />
              {formatHours(row.totalHours)}
              {row.targetHours !== null && (
                <span className="text-white/60">/ {formatHours(row.targetHours)}</span>
              )}
              <span className="text-white/60">esta semana</span>
            </p>
          </div>
        </div>

        {progress !== null && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/20"
            role="img"
            aria-label={`${formatHours(row.totalHours)} de la meta`}
          >
            {progress > 0 && (
              <div
                className="h-full rounded-full bg-o-500"
                style={{ width: `${(progress * 100).toFixed(1)}%` }}
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {/* El ciclo de D-09, tal cual viene: abierta, enviada o aprobada. */}
          <Pill
            className={
              row.weekStatus === 'PENDING_APPROVAL'
                ? 'border border-dashed border-white/70 bg-purple/40 text-white'
                : 'bg-white/15 text-white'
            }
          >
            {TIMESHEET_WEEK_STATUS_LABEL[row.weekStatus as TimesheetWeekStatus] ?? row.weekStatus}
          </Pill>
          {/* Un timesheet ES una requisición por semana. El badge es discreto
              (la tarjeta ya tiene bastante naranja) y ABRE la requisición. */}
          {requisitionRef !== null && (
            <Link
              to={`/requisiciones/${row.requisitionId}`}
              title="Abrir la requisición"
              onMouseEnter={() => onRequisitionHover?.(true)}
              onMouseLeave={() => onRequisitionHover?.(false)}
              onFocus={() => onRequisitionHover?.(true)}
              onBlur={() => onRequisitionHover?.(false)}
              className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
            >
              <MaterialIcon name="assignment" className="text-xs" />
              {requisitionRef}
              <MaterialIcon name="chevron_right" className="text-xs" />
            </Link>
          )}
        </div>

        {/* El ciclo completo de D-09 en la tarjeta: enviar (SUP) y aprobar (managers). */}
        <div className="flex flex-wrap gap-1.5">
          {row.weekStatus === 'OPEN' && (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  void runAction('submit')
                }}
                className="cursor-pointer rounded-md bg-o-500 px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-o-500/85 disabled:cursor-wait disabled:opacity-60"
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
                  className="cursor-pointer rounded-md border border-white/40 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/10"
                >
                  Marca manual
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
                  className="cursor-pointer rounded-md bg-green px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-green/85 disabled:cursor-wait disabled:opacity-60"
                >
                  {isApproving ? 'Aprobando…' : 'Aprobar semana'}
                </button>
              </ApproverTooltip>
            ) : (
              <ApproverTooltip>
                <span className="max-w-full cursor-help truncate rounded-md border border-dashed border-white/40 px-2 py-1 text-[10px] text-white/80">
                  Esperando aprobación
                </span>
              </ApproverTooltip>
            ))}
        </div>

        {actionError !== null && (
          <p role="alert" className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red">
            {actionError}
          </p>
        )}
      </div>
    </div>
  )
}
