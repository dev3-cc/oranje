import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon, toast } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import {
  useAppApproveTimesheetMutation,
  useAppCreateManualPunchMutation,
  useAppReviewTimesheetDayMutation,
  useAppSubmitTimesheetMutation,
  useAppTimesheetQuery,
  type AppTimesheetDay,
  type AppTimesheetRow,
  type PunchType,
} from './timesheetAppApi'
import { DAY_DOT, WeekStatusChip } from './timesheetParts'

import { LoadError } from '@/shared/components/LoadError'
import { PUNCH_STATE_LABEL } from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { clock24In, formatDate, formatDayMonth, formatHours } from '@/shared/lib/formatters'

const PUNCH_LABEL: Record<PunchType, MessageDescriptor> = {
  CLOCK_IN: msg`Entrada`,
  LUNCH_OUT: msg`Salida a lunch`,
  LUNCH_IN: msg`Regreso de lunch`,
  CLOCK_OUT: msg`Salida`,
}

/** Mismos textos que el web (`WorkerWeekSummary`): comparten traducción. */
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

function manualPunchErrorMessage(error: unknown, i18n: I18n, workDate: string): string {
  return apiErrorMessage(error, {
    byCode: {
      ASSIGNMENT_NOT_FOUND: i18n._(msg`El colaborador ya no tiene asignación en esta requisición.`),
      PUNCH_ALREADY_REGISTERED: i18n._(
        msg`Esa marca ya quedó registrada el ${formatDayMonth(workDate)}.`,
      ),
    },
    fallback: i18n._(msg`No se pudo registrar la marca. Inténtalo de nuevo.`),
  })
}

/** Por qué no se capturan marcas, si no se puede; `null` = sí se puede. Igual que el web. */
function manualPunchBlockOf(assignment: AppTimesheetRow['assignment']): MessageDescriptor | null {
  if (assignment === undefined || assignment?.status === 'ACTIVE') return null
  if (assignment === null) {
    return msg`Sin asignación en esta requisición: no hay contra qué capturar marcas`
  }
  if (assignment.status === 'CANCELLED') {
    return msg`La asignación se canceló: las horas registradas se conservan, pero ya no se capturan marcas`
  }
  return msg`La asignación terminó: las horas se aprueban y pagan, pero ya no se capturan marcas`
}

const FIELD = 'min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink'

function DayCard({
  day,
  timeZone,
  canReview,
  onReviewed,
}: {
  day: AppTimesheetDay
  timeZone: string | undefined
  canReview: boolean
  onReviewed: () => void
}): ReactNode {
  const { t, i18n } = useLingui()
  const [review, { isLoading }] = useAppReviewTimesheetDayMutation()
  const [isReviewing, setReviewing] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isPending = day.hasAnomaly && day.reviewNote === null
  const weekday = new Intl.DateTimeFormat(i18n.locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${day.date}T00:00:00Z`),
  )

  async function save(): Promise<void> {
    setError(null)
    try {
      await review({ dayId: day.id, note: note.trim() }).unwrap()
      toast.success(t`Día revisado`)
      setReviewing(false)
      onReviewed()
    } catch (cause) {
      setError(
        apiErrorMessage(cause, {
          fallback: i18n._(msg`No se pudo guardar la revisión. Inténtalo de nuevo.`),
        }),
      )
    }
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-2xl border bg-surface p-4',
        isPending ? 'border-red/40' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', DAY_DOT[day.punchState])} aria-hidden />
          <p className="text-sm font-semibold text-ink first-letter:uppercase">
            {weekday} {formatDayMonth(day.date)}
          </p>
        </div>
        <span className="text-sm font-semibold text-ink tabular-nums">
          {day.punches.length === 0 ? '—' : formatHours(day.netHours)}
        </span>
      </div>
      {day.punches.length === 0 ? (
        <p className="text-xs text-ink-3">{PUNCH_STATE_LABEL.NO_SHIFT}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {day.punches.map((punch) => (
            <li key={punch.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink-2">
                {PUNCH_LABEL[punch.type as PunchType]
                  ? i18n._(PUNCH_LABEL[punch.type as PunchType])
                  : punch.type}
                {punch.isManual && (
                  <span className="ml-1.5 rounded-full bg-o-50 px-1.5 text-[11px] font-semibold text-o-700">
                    <Trans>Manual</Trans>
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 font-medium text-ink tabular-nums">
                {punch.insideGeofence === false && (
                  <MaterialIcon
                    name="wrong_location"
                    className="text-base text-red"
                    aria-label={t`Fuera de la geocerca`}
                  />
                )}
                {clock24In(punch.serverAt, timeZone)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isPending && (
        <p className="text-xs font-semibold text-red">
          <Trans>Anomalía sin revisar</Trans>
        </p>
      )}
      {day.reviewNote !== null && (
        <p className="rounded-lg bg-surface-2 p-2 text-xs text-ink-2">
          <Trans>Nota:</Trans> {day.reviewNote}
        </p>
      )}
      {canReview &&
        isPending &&
        !day.id.startsWith('empty-') &&
        (isReviewing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
              }}
              rows={3}
              aria-label={t`Nota de revisión`}
              placeholder={t`Qué pasó y cómo se resolvió…`}
              className="rounded-xl border border-line bg-surface p-3 text-base text-ink"
            />
            {error && <p className="text-sm text-red">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={note.trim() === '' || isLoading}
                onClick={() => {
                  void save()
                }}
                className="min-h-11 flex-1 rounded-xl bg-o-300 px-3 text-sm font-semibold text-ink disabled:opacity-50"
              >
                <Trans>Guardar revisión</Trans>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewing(false)
                }}
                className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink-2"
              >
                <Trans>Cancelar</Trans>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReviewing(true)
            }}
            className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink"
          >
            <Trans>Revisar día</Trans>
          </button>
        ))}
    </li>
  )
}

/**
 * La semana de una persona: sus días con cada marca (hora del hotel, manual,
 * fuera de geocerca) y las acciones de D-09, cada una con su permiso:
 *
 *   Revisar día   `timesheet:review_punches`, semana abierta, día con anomalía.
 *   Marca manual  `timesheet:create_manual_punch`, semana abierta, asignación activa.
 *   Enviar        `timesheet:review_punches`, semana abierta y sin anomalías.
 *   Aprobar       `timesheet:approve_hours`, semana enviada.
 */
export function TimesheetWeekPage(): ReactNode {
  const { t, i18n } = useLingui()
  const { timesheetId = '' } = useParams()
  const can = useCan()
  const { data: row, isLoading, error, refetch } = useAppTimesheetQuery(timesheetId)
  const [submit, { isLoading: isSubmitting }] = useAppSubmitTimesheetMutation()
  const [approve, { isLoading: isApproving }] = useAppApproveTimesheetMutation()
  const [createPunch, { isLoading: isPunching }] = useAppCreateManualPunchMutation()
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPunchOpen, setPunchOpen] = useState(false)
  const [punchType, setPunchType] = useState<PunchType>('CLOCK_IN')
  const [punchDate, setPunchDate] = useState('')
  const [punchTime, setPunchTime] = useState('')
  const [punchReason, setPunchReason] = useState('')

  const back = (
    <Link
      to={row ? `/hotel/timesheet?week=${row.weekStart}` : '/hotel/timesheet'}
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-o-700"
    >
      <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
      <Trans>Timesheet</Trans>
    </Link>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy aria-label={t`Cargando`}>
        {back}
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    )
  }

  if (error || !row) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudo cargar la semana.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      </div>
    )
  }

  const isOpen = row.status === 'OPEN'
  const canReview = isOpen && can('timesheet:review_punches')
  const canSubmit = isOpen && can('timesheet:review_punches')
  const canApprove = row.status === 'PENDING_APPROVAL' && can('timesheet:approve_hours')
  const punchBlock = manualPunchBlockOf(row.assignment)
  const canManualPunch = isOpen && can('timesheet:create_manual_punch')
  const anomalies = row.pendingAnomalies
  const submitBlock =
    anomalies > 0
      ? t`${plural(anomalies, { one: '# día con anomalía', other: '# días con anomalía' })} por revisar: resuélvelos antes de enviar la semana`
      : null

  async function runAction(action: 'submit' | 'approve'): Promise<void> {
    setActionError(null)
    try {
      if (action === 'submit') {
        await submit(timesheetId).unwrap()
        toast.success(t`Semana enviada a revisión`)
      } else {
        await approve(timesheetId).unwrap()
        toast.success(t`Semana aprobada`)
      }
    } catch (cause) {
      setActionError(weekActionErrorMessage(cause, i18n))
    }
  }

  async function savePunch(): Promise<void> {
    if (!row) return
    setActionError(null)
    try {
      await createPunch({
        requisitionId: row.requisitionId,
        workerId: row.workerId,
        type: punchType,
        workDate: punchDate,
        /* Igual que el web: la hora que se escribe, en el reloj del teléfono. */
        occurredAt: new Date(`${punchDate}T${punchTime}:00`).toISOString(),
        reason: punchReason.trim(),
      }).unwrap()
      toast.success(t`Marca registrada`)
      setPunchOpen(false)
      setPunchReason('')
      setPunchTime('')
    } catch (cause) {
      setActionError(manualPunchErrorMessage(cause, i18n, punchDate))
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {back}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-ink-3">{row.requisitionNumber}</p>
          <WeekStatusChip status={row.status} />
        </div>
        <h1 className="-mt-1 text-lg font-bold text-ink">{row.workerName}</h1>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <dd className="text-lg font-semibold text-ink tabular-nums">
              {formatHours(row.totalHours)}
            </dd>
            <dt className="text-[11px] text-ink-3">
              <Trans>Horas</Trans>
            </dt>
          </div>
          <div>
            <dd className="text-lg font-semibold text-ink tabular-nums">
              {formatHours(row.overtimeHours)}
            </dd>
            <dt className="text-[11px] text-ink-3">
              <Trans>Overtime</Trans>
            </dt>
          </div>
          <div>
            <dd
              className={cn(
                'text-lg font-semibold tabular-nums',
                anomalies > 0 ? 'text-red' : 'text-ink-3',
              )}
            >
              {anomalies}
            </dd>
            <dt className="text-[11px] text-ink-3">
              <Trans>Anomalías</Trans>
            </dt>
          </div>
        </dl>
        <p className="text-xs text-ink-3">
          {formatDate(row.weekStart)} – {formatDate(row.weekEnd)}
        </p>
      </section>

      <ul className="flex flex-col gap-3">
        {row.days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            timeZone={row.timeZone}
            canReview={canReview}
            onReviewed={() => {
              void refetch()
            }}
          />
        ))}
      </ul>

      {actionError && (
        <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
          {actionError}
        </p>
      )}

      {canManualPunch &&
        (isPunchOpen ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <p className="text-sm font-semibold text-ink">
              <Trans>Marca manual</Trans>
            </p>
            <p className="text-xs text-ink-2">
              <Trans>
                Registras la hora real del hecho, no la de ahora: esa es la que cuenta horas para la
                nómina.
              </Trans>
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              <Trans>Tipo</Trans>
              <select
                value={punchType}
                onChange={(event) => {
                  setPunchType(event.target.value as PunchType)
                }}
                className={FIELD}
              >
                {(Object.keys(PUNCH_LABEL) as PunchType[]).map((type) => (
                  <option key={type} value={type}>
                    {i18n._(PUNCH_LABEL[type])}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                <Trans>Día</Trans>
                <input
                  type="date"
                  min={row.weekStart}
                  max={row.weekEnd}
                  value={punchDate}
                  onChange={(event) => {
                    setPunchDate(event.target.value)
                  }}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
                <Trans>Hora</Trans>
                <input
                  type="time"
                  value={punchTime}
                  onChange={(event) => {
                    setPunchTime(event.target.value.slice(0, 5))
                  }}
                  className={FIELD}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              <Trans>Motivo</Trans>
              <textarea
                value={punchReason}
                onChange={(event) => {
                  setPunchReason(event.target.value)
                }}
                rows={2}
                placeholder={t`La geocerca rechazó la marca, se acabó la pila…`}
                className="rounded-xl border border-line bg-surface p-3 text-base font-normal text-ink"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!punchDate || !punchTime || punchReason.trim() === '' || isPunching}
                onClick={() => {
                  void savePunch()
                }}
                className="min-h-12 flex-1 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink disabled:opacity-50"
              >
                <Trans>Registrar marca</Trans>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPunchOpen(false)
                }}
                className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink-2"
              >
                <Trans>Cancelar</Trans>
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            disabled={punchBlock !== null}
            onClick={() => {
              setActionError(null)
              setPunchDate(row.weekStart)
              setPunchOpen(true)
            }}
            className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:opacity-50"
          >
            <Trans>Agregar marca manual</Trans>
          </button>
        ))}
      {canManualPunch && punchBlock !== null && (
        <p className="text-xs text-ink-3">{i18n._(punchBlock)}</p>
      )}

      {canSubmit && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={submitBlock !== null || isSubmitting}
            onClick={() => {
              void runAction('submit')
            }}
            className="min-h-12 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs disabled:opacity-50"
          >
            <Trans>Enviar semana a aprobación</Trans>
          </button>
          {submitBlock && <p className="text-xs text-ink-3">{submitBlock}</p>}
        </div>
      )}

      {canApprove && (
        <button
          type="button"
          disabled={isApproving}
          onClick={() => {
            void runAction('approve')
          }}
          className="min-h-12 rounded-xl bg-o-300 px-4 text-sm font-semibold text-ink shadow-xs disabled:opacity-50"
        >
          <Trans>Aprobar semana</Trans>
        </button>
      )}
    </div>
  )
}
