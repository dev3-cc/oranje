import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  cn,
  MaterialIcon,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast,
} from '@oranje/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useApproveTimesheetMutation, useSubmitTimesheetMutation } from '../api/timesheetApi'
import type { TimesheetRow } from '../types/timesheet.types'

import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatDate } from '@/shared/lib/formatters'

type WeekAction = 'submit' | 'approve' | 'approve_now'

/** El texto del modal de confirmación, uno por acción — todas terminan en lo
    mismo: se congela y lo que cambie después pasa por Oranje (Hugo, 2026-10-12). */
const CONFIRM_COPY: Record<WeekAction, { title: MessageDescriptor; body: MessageDescriptor }> = {
  submit: {
    title: msg`¿Enviar la semana a revisión?`,
    body: msg`El hotel ya no podrá editar estos días: ni marca manual ni corregir una marca. Si algo cambia después de enviarla, contacta a Oranje.`,
  },
  approve: {
    title: msg`¿Aprobar la semana?`,
    body: msg`Queda lista para pago y factura, y deja de poder corregirse desde aquí. Si algo cambia después de aprobarla, contacta a Oranje.`,
  },
  approve_now: {
    title: msg`¿Enviar y aprobar la semana?`,
    body: msg`Se manda y se aprueba en un solo paso: el hotel ya no podrá editar estos días. Si algo cambia después, contacta a Oranje.`,
  },
}

/** El `i18n` viene del componente (`useLingui`): así el mensaje habla el idioma activo (D-36). */
function weekActionErrorMessage(error: unknown, i18n: I18n): string {
  return apiErrorMessage(error, {
    byCode: {
      ANOMALIES_PENDING: i18n._(
        msg`Quedan días con anomalía sin resolver: revísalos antes de enviar la semana.`,
      ),
      DAYS_WITHOUT_STATUS: i18n._(
        msg`Quedan días sin marca ni estado: marca Descanso, OFF… en cada uno antes de enviar la semana.`,
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

/**
 * El ciclo completo de D-09 en un solo lugar — enviar (Supervisor), enviar
 * y aprobar en un clic (Manager de Área/General, que hereda el envío), y
 * marca manual. Factorizado de `WorkerWeekSummary` (Hugo, 2026-10-10: "que
 * el botón esté en la tabla") para poder vivir en dos sitios con la misma
 * lógica — la tarjeta de resumen y el encabezado de la tabla de días — sin
 * dos copias del mismo `runAction`.
 */
export function WeekActionBar({
  row,
  onManualPunch,
}: {
  row: TimesheetRow
  onManualPunch?: ((row: TimesheetRow) => void) | undefined
}): ReactNode {
  const { t, i18n } = useLingui()
  const [submitSheet, { isLoading: isSubmitting }] = useSubmitTimesheetMutation()
  const [approveSheet, { isLoading: isApproving }] = useApproveTimesheetMutation()
  const [actionError, setActionError] = useState<string | null>(null)
  /* El botón se queda "pegado" entre que la escritura termina y el refetch
     que invalida trae la fila al día — ahí no hay ningún spinner (Hugo,
     2026-10-09). Se sigue mostrando ocupado hasta que el estado de ESTA
     fila de verdad cambie, no solo hasta que la mutación responda. Con
     salida de emergencia: si en 8s no llegó el refetch, se suelta solo —
     mejor un botón que vuelve a intentar que uno atorado para siempre. */
  const [pendingAction, setPendingAction] = useState<WeekAction | null>(null)
  /* El clic no ejecuta directo — abre la confirmación (Hugo, 2026-10-12):
     una vez enviada, el hotel se queda sin forma de corregir desde aquí. */
  const [confirmAction, setConfirmAction] = useState<WeekAction | null>(null)
  const statusBeforeAction = useRef(row.weekStatus)

  useEffect(() => {
    if (pendingAction && row.weekStatus !== statusBeforeAction.current) {
      setPendingAction(null)
    }
  }, [row.weekStatus, pendingAction])

  useEffect(() => {
    if (!pendingAction) return undefined
    const timeout = window.setTimeout(() => {
      setPendingAction(null)
    }, 8000)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [pendingAction])

  const can = useCan()
  /** Aprobar es de los Managers (timesheet:approve_hours); el Supervisor envía y captura. */
  const canApprove = can('timesheet:approve_hours')
  /** Enviar es de quien revisa; el Observador solo lee y no ve el botón. */
  const canSubmit = can('timesheet:review_punches')

  /* Lo que el back rechazaría DESPUÉS se dice ANTES, en el botón (patrón
     honesto: deshabilitado con título). Enviar exige cero anomalías; capturar
     marcas exige una asignación ACTIVA — cerrada o cancelada, las horas son
     historia: se aprueban y pagan, pero ya no se captura. */
  const anomalies = row.entries.filter((entry) => entry.hasAnomaly).length
  /* Sin Schedule, un día sin ponches no deja fila por sí solo: el back ahora
     rellena los 7 siempre, así que "sin marca" se ve aquí como un día con
     cero ponches y sin estado (Descanso, OFF…) elegido (Hugo, 2026-10-12). */
  const unmarked = row.entries.filter(
    (entry) =>
      entry.startTime === null &&
      entry.endTime === null &&
      entry.dayStatus === null &&
      !entry.isAbsence,
  ).length
  const submitBlock =
    anomalies > 0
      ? t`${plural(anomalies, { one: '# día con anomalía', other: '# días con anomalía' })} por revisar: resuélvelos antes de enviar la semana`
      : unmarked > 0
        ? t`${plural(unmarked, { one: '# día sin marca ni estado', other: '# días sin marca ni estado' })}: marca Descanso, OFF… en cada uno antes de enviar la semana`
        : null
  const manualPunchBlockDescriptor = manualPunchBlockOf(row.assignment)
  const manualPunchBlock =
    manualPunchBlockDescriptor === null ? null : i18n._(manualPunchBlockDescriptor)

  const isSendingOrSettling = isSubmitting || pendingAction === 'submit'
  const isApprovingOrSettling =
    isApproving || pendingAction === 'approve' || pendingAction === 'approve_now'

  async function runAction(action: WeekAction): Promise<void> {
    setActionError(null)
    setConfirmAction(null)
    statusBeforeAction.current = row.weekStatus
    setPendingAction(action)
    try {
      if (action === 'submit') {
        await submitSheet(row.timesheetId).unwrap()
        toast.success(t`Semana enviada a revisión`)
      } else if (action === 'approve') {
        await approveSheet(row.timesheetId).unwrap()
        toast.success(t`Semana aprobada`)
      } else {
        /* Quien aprueba (Manager de Área/General) también envía por
           herencia — obligarlo a dos clics en dos botones distintos solo
           confundía: "¿por qué dice Enviar si yo apruebo?" (Hugo,
           2026-10-10). Un solo botón que dice lo que SÍ va a terminar
           pasando, y hace las dos llamadas detrás. */
        await submitSheet(row.timesheetId).unwrap()
        await approveSheet(row.timesheetId).unwrap()
        toast.success(t`Semana enviada y aprobada`)
      }
      // No se limpia `pendingAction` aquí a propósito: sigue ocupado hasta
      // que la fila refrescada llegue (el `useEffect` de arriba la suelta).
    } catch (error) {
      setActionError(weekActionErrorMessage(error, i18n))
      setPendingAction(null)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Con "Aprobar todas" oculto (Hugo, 2026-10-12), este botón vuelve a
          ser la ÚNICA entrada para enviar/aprobar: gana tamaño e ícono para
          que no se pierda junto a la tabla. */}
      <div className="flex flex-wrap items-center gap-2">
        {row.weekStatus === 'OPEN' && (
          <>
            {canApprove
              ? (() => {
                  const submitButton = (
                    <button
                      type="button"
                      disabled={isApprovingOrSettling || submitBlock !== null}
                      title={submitBlock ?? t`Un solo clic: manda la semana y la deja aprobada`}
                      onClick={() => {
                        setConfirmAction('approve_now')
                      }}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-green/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-wait disabled:opacity-60"
                    >
                      <MaterialIcon name="done_all" className="text-base" aria-hidden />
                      {isApprovingOrSettling ? t`Enviando y aprobando…` : t`Enviar y aprobar`}
                    </button>
                  )
                  // Con una anomalía bloqueando, el tooltip de "quién aprueba"
                  // sobra y se encimaba con el motivo del bloqueo — dos globos
                  // de texto pisándose (Hugo, 2026-10-12, con captura). Un solo
                  // mensaje a la vez: el que de verdad importa ahora.
                  return submitBlock === null ? (
                    <ApproverTooltip>{submitButton}</ApproverTooltip>
                  ) : (
                    submitButton
                  )
                })()
              : canSubmit && (
                  <button
                    type="button"
                    disabled={isSendingOrSettling || submitBlock !== null}
                    title={submitBlock ?? t`Mandar la semana a aprobación del Manager`}
                    onClick={() => {
                      setConfirmAction('submit')
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-md bg-o-300 shadow-xs px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-o-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:opacity-60',
                      isSendingOrSettling ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed',
                    )}
                  >
                    <MaterialIcon name="send" className="text-base" aria-hidden />
                    {isSendingOrSettling ? t`Enviando…` : t`Enviar a revisión`}
                  </button>
                )}
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
                className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={isApprovingOrSettling}
                onClick={() => {
                  setConfirmAction('approve')
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-green/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500 disabled:cursor-wait disabled:opacity-60"
              >
                <MaterialIcon name="check_circle" className="text-base" aria-hidden />
                {isApprovingOrSettling ? t`Aprobando…` : t`Aprobar semana`}
              </button>
            </ApproverTooltip>
          ) : (
            <ApproverTooltip>
              <span className="max-w-full cursor-help truncate rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-3">
                <Trans>Esperando aprobación</Trans>
              </span>
            </ApproverTooltip>
          ))}
        {row.weekStatus === 'APPROVED' && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-green/10 px-3 py-1.5 text-sm font-semibold text-green">
            <MaterialIcon name="check_circle" className="text-base" aria-hidden />
            <Trans>Aprobada y enviada a Oranje</Trans>
          </span>
        )}
        {/* Fila sintetizada para que no desaparezca quien no ponchó ni un
            día (Hugo, 2026-10-13): sin timesheet real, nada que enviar ni
            aprobar — y nada que capturar desde aquí tampoco. */}
        {row.weekStatus === 'NO_TIMESHEET' && (
          <span className="max-w-full truncate rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-3">
            <Trans>Sin Timesheet esta semana — no registró ni una marca</Trans>
          </span>
        )}
      </div>

      {actionError !== null && (
        <p role="alert" className="rounded-md bg-red/10 px-2 py-1 text-xs font-medium text-red">
          {actionError}
        </p>
      )}

      {confirmAction !== null && (
        <Modal
          isOpen
          onClose={() => {
            setConfirmAction(null)
          }}
          title={i18n._(CONFIRM_COPY[confirmAction].title)}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmAction(null)
                }}
              >
                <Trans>Cancelar</Trans>
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void runAction(confirmAction)
                }}
              >
                <Trans>Sí, continuar</Trans>
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">{i18n._(CONFIRM_COPY[confirmAction].body)}</p>
        </Modal>
      )}
    </div>
  )
}
