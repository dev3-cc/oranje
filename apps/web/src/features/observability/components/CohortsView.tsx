import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import {
  useGetObserverPunchesSinceQuery,
  useGetObserverWorkerHistoriesQuery,
} from '../api/observabilityApi'
import {
  addWeeks,
  buildPresence,
  COHORT_OUTCOME_LABEL,
  COHORT_OUTCOMES,
  type CohortMember,
  cohortDetail,
  cohortSizes,
  type Granularity,
  mondayOf,
  retentionAt,
  retentionTable,
  STATES_WITH_REASON,
} from '../lib/cohorts'
import { localDay } from '../lib/period'

import { PeopleNotice } from './PeopleView'
import { TruncatedNotice } from './TabParts'

import { WORKER_STATUS_LABEL, type WorkerStatus } from '@/shared/constants/workerStatus'
import { formatPercent, formatWeekRange } from '@/shared/lib/formatters'
import type { RequisitionApi, TimesheetApi, WorkerApi } from '@/shared/types/apiContract.types'

/** Cohortes que se pueden elegir y filas de la tabla de retención. */
const COHORT_WEEKS = 12
const COHORT_MONTHS = 6

/** `lunes` → «28 sep – 4 oct» (el domingo es el lunes siguiente menos un día). */
function weekRangeOf(monday: string): string {
  const sunday = new Date(Date.parse(`${addWeeks(monday, 1)}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10)
  return formatWeekRange(monday, sunday)
}

function Stat({
  label,
  value,
  detail,
  hint,
}: {
  label: ReactNode
  value: string
  detail?: ReactNode
  hint?: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-ink tabular-nums">{value}</span>
        {detail && <span className="text-sm text-ink-3 tabular-nums">{detail}</span>}
      </p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

function share(part: number, whole: number): string {
  return whole === 0 ? '—' : formatPercent(part / whole)
}

/**
 * «Ingresos» en Colaborador: qué pasó con quienes empezaron a trabajar en una
 * semana, y la retención por cohorte semanal o mensual.
 */
export function CohortsView({
  timesheets,
  truncated,
  workers,
  requisitions,
}: {
  timesheets: TimesheetApi[]
  truncated: boolean
  workers: WorkerApi[]
  requisitions: RequisitionApi[]
}): ReactNode {
  const { i18n, t } = useLingui()
  const currentWeek = mondayOf(new Date().toLocaleDateString('en-CA'))
  const [week, setWeek] = useState(() => addWeeks(currentWeek, -1))
  const [granularity, setGranularity] = useState<Granularity>('week')

  const hotelOf = new Map(
    requisitions.map((requisition) => [requisition.id, requisition.hotel.name]),
  )
  const presence = buildPresence(timesheets, hotelOf)
  const workersById = new Map(workers.map((worker) => [worker.id, worker]))
  const sizes = cohortSizes(presence, currentWeek, COHORT_WEEKS)
  const detail = cohortDetail(presence, week, currentWeek, workersById)
  const size = detail.members.length

  /* «¿Regresaron el lunes?» necesita los ponches de ese lunes: solo para las
     dos cohortes más recientes, las que caben en la ventana de ponches. */
  const nextMonday = addWeeks(week, 1)
  const mondayInReach = nextMonday <= currentWeek && nextMonday >= addWeeks(currentWeek, -1)
  const [year, month, day] = nextMonday.split('-').map(Number) as [number, number, number]
  const punches = useGetObserverPunchesSinceQuery(new Date(year, month - 1, day).toISOString(), {
    skip: !mondayInReach || size === 0,
  })
  const memberIds = new Set(detail.members.map((member) => member.workerId))
  const backMonday = punches.data
    ? new Set(
        punches.data.rows
          .filter(
            (punch) =>
              memberIds.has(punch.workerId) &&
              localDay(punch.serverAt, punch.hotelTimeZone) === nextMonday,
          )
          .map((punch) => punch.workerId),
      ).size
    : null

  /* El motivo exacto (temporada baja, inasistencias…) solo de quien salió por
     un estado que lo lleva: una llamada por persona de esta cohorte. */
  const needReason = detail.members
    .filter(
      (member) => member.outcome !== 'ACTIVE' && STATES_WITH_REASON.has(member.stateCode ?? ''),
    )
    .map((member) => member.workerId)
    .sort()
  const histories = useGetObserverWorkerHistoriesQuery(needReason, {
    skip: needReason.length === 0,
  })
  const reasonOf = (member: CohortMember): string | null => {
    const entries = histories.data?.[member.workerId] ?? []
    const last = [...entries]
      .filter((entry) => entry.toState === member.stateCode)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
    return last?.reason ?? null
  }

  const exited = detail.members.filter((member) => member.outcome !== 'ACTIVE')
  const breakdown = COHORT_OUTCOMES.flatMap((outcome) => {
    const group = exited.filter((member) => member.outcome === outcome)
    if (group.length === 0) return []
    const reasons = new Map<string, number>()
    for (const member of group) {
      const reason = reasonOf(member)
      if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
    return [{ outcome, count: group.length, reasons: [...reasons] }]
  })

  const retention = retentionTable(
    presence,
    granularity,
    currentWeek,
    granularity === 'week' ? COHORT_WEEKS : COHORT_MONTHS,
  )
  const columns = Math.max(0, ...retention.map((row) => row.cells.length))
  const monthLabel = (month: string): string =>
    new Date(`${month}-01T00:00:00Z`).toLocaleDateString(i18n.locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })

  const at1 = retentionAt(presence, 1, currentWeek, COHORT_WEEKS)
  const at4 = retentionAt(presence, 4, currentWeek, COHORT_WEEKS * 2)
  const at12 = retentionAt(presence, 12, currentWeek, COHORT_WEEKS * 3)

  return (
    <div className="flex flex-col gap-6">
      <PeopleNotice>
        <Trans>
          «Ingresó» = su primera semana con ponches en todo su historial. «Trabajó» una semana =
          ponchó al menos una vez esa semana; no dice cuántos días. Lo que pasó con quien ya no
          trabaja sale de su estado actual en el Semáforo del Colaborador.
        </Trans>
      </PeopleNotice>
      {truncated && <TruncatedNotice />}

      {/* Retención de las cohortes recientes, en una línea. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={<Trans>Regresaron la semana siguiente</Trans>}
          value={at1 ? share(at1.part, at1.whole) : '—'}
          detail={
            at1 && (
              <Trans>
                {at1.part} de {at1.whole}
              </Trans>
            )
          }
          hint={<Trans>Ingresos de las últimas 12 semanas</Trans>}
        />
        <Stat
          label={<Trans>Siguen a las 4 semanas</Trans>}
          value={at4 ? share(at4.part, at4.whole) : '—'}
          detail={
            at4 && (
              <Trans>
                {at4.part} de {at4.whole}
              </Trans>
            )
          }
          hint={<Trans>Trabajaron en su semana 4 · ~30 días</Trans>}
        />
        <Stat
          label={<Trans>Siguen a las 12 semanas</Trans>}
          value={at12 ? share(at12.part, at12.whole) : '—'}
          detail={
            at12 && (
              <Trans>
                {at12.part} de {at12.whole}
              </Trans>
            )
          }
          hint={<Trans>Trabajaron en su semana 12 · ~90 días</Trans>}
        />
      </section>

      {/* Una cohorte: qué pasó con quienes ingresaron esa semana. */}
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">
            <Trans>¿Qué pasó con los que ingresaron?</Trans>
          </h3>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <Trans>Semana de ingreso</Trans>
            <select
              id="cohort-week"
              value={week}
              onChange={(event) => {
                setWeek(event.target.value)
              }}
              className="min-h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
            >
              {sizes.map((item) => (
                <option key={item.week} value={item.week}>
                  {weekRangeOf(item.week)} · {item.size}
                </option>
              ))}
            </select>
          </label>
        </div>

        {size === 0 ? (
          <p className="text-sm text-ink-3">
            <Trans>Nadie empezó a trabajar esa semana.</Trans>
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={<Trans>Ingresaron</Trans>} value={String(size)} />
              <Stat
                label={<Trans>Regresaron el lunes</Trans>}
                value={backMonday === null ? '—' : share(backMonday, size)}
                detail={
                  backMonday !== null && (
                    <Trans>
                      {backMonday} de {size}
                    </Trans>
                  )
                }
                hint={
                  !mondayInReach ? (
                    nextMonday > currentWeek ? (
                      <Trans>Su lunes todavía no llega.</Trans>
                    ) : (
                      <Trans>Solo para las dos semanas más recientes.</Trans>
                    )
                  ) : undefined
                }
              />
              <Stat
                label={<Trans>Trabajaron la semana siguiente</Trans>}
                value={
                  detail.returnedNextWeek === null ? '—' : share(detail.returnedNextWeek, size)
                }
                detail={
                  detail.returnedNextWeek !== null && (
                    <Trans>
                      {detail.returnedNextWeek} de {size}
                    </Trans>
                  )
                }
                hint={
                  detail.returnedNextWeek === null ? (
                    <Trans>La semana siguiente todavía no empieza.</Trans>
                  ) : undefined
                }
              />
              <Stat
                label={<Trans>Siguen trabajando</Trans>}
                value={share(detail.active, size)}
                detail={
                  <Trans>
                    {detail.active} de {size}
                  </Trans>
                }
                hint={
                  <Trans>Ponchó esta semana o la pasada, después de su semana de ingreso.</Trans>
                }
              />
            </div>

            {breakdown.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-ink-2">
                  <Trans>Qué pasó con quienes ya no trabajan</Trans> · {exited.length}
                </h4>
                <ul className="flex flex-col gap-2">
                  {breakdown.map((item) => (
                    <li key={item.outcome} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink">
                          {i18n._(COHORT_OUTCOME_LABEL[item.outcome])}
                        </span>
                        <span className="font-semibold text-ink tabular-nums">
                          {item.count} · {share(item.count, size)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-o-300"
                          style={{ width: `${String((item.count / size) * 100)}%` }}
                        />
                      </div>
                      {item.reasons.length > 0 && (
                        <p className="text-xs text-ink-3">
                          {item.reasons
                            .map(([reason, count]) => `${reason}: ${String(count)}`)
                            .join(' · ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="px-3 py-2 font-semibold">
                      <Trans>Colaborador</Trans>
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      <Trans>Hotel al ingresar</Trans>
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      <Trans>Semanas trabajadas</Trans>
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      <Trans>Última semana</Trans>
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      <Trans>Qué pasó</Trans>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.members.map((member) => {
                    const reason = reasonOf(member)
                    return (
                      <tr key={member.workerId} className="border-b border-line last:border-0">
                        <td className="px-3 py-2">
                          <Link
                            to={`/collaborator-pool/${member.workerId}`}
                            className="font-semibold text-ink hover:underline"
                          >
                            {member.name}
                          </Link>
                          {member.stateCode && (
                            <p className="text-xs text-ink-3">
                              {WORKER_STATUS_LABEL[member.stateCode as WorkerStatus] ??
                                member.stateCode}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-ink-2">{member.hotels.join(', ') || '—'}</td>
                        <td className="px-3 py-2 text-right text-ink tabular-nums">
                          {member.weeksWorked}
                        </td>
                        <td className="px-3 py-2 text-ink-2 tabular-nums">
                          {weekRangeOf(member.lastWeek)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2',
                            member.outcome === 'ACTIVE' ? 'text-ink-2' : 'font-medium text-ink',
                          )}
                        >
                          {i18n._(COHORT_OUTCOME_LABEL[member.outcome])}
                          {reason && <span className="text-ink-3"> · {reason}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Retención por cohorte. */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">
            <Trans>Retención por cohorte</Trans>
          </h3>
          <div
            role="radiogroup"
            aria-label={t`Agrupar por`}
            className="inline-flex rounded-xl border border-line bg-surface p-1"
          >
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={granularity === option}
                onClick={() => {
                  setGranularity(option)
                }}
                className={cn(
                  'min-h-8 rounded-lg px-3 text-sm font-medium',
                  granularity === option ? 'bg-o-50 text-ink' : 'text-ink-3 hover:text-ink',
                )}
              >
                {option === 'week' ? t`Semanal` : t`Mensual`}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-3">
          {granularity === 'week' ? (
            <Trans>
              Cada fila son quienes ingresaron esa semana; cada columna, qué parte trabajó k semanas
              después. La columna en curso todavía puede subir.
            </Trans>
          ) : (
            <Trans>
              Cada fila son quienes ingresaron ese mes; cada columna, qué parte trabajó k meses
              después. El mes en curso todavía puede subir.
            </Trans>
          )}
        </p>
        {retention.length === 0 ? (
          <p className="text-sm text-ink-3">
            <Trans>Todavía no hay ingresos que medir.</Trans>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3">
                  <th className="sticky left-0 bg-surface px-3 py-2 text-left font-semibold">
                    <Trans>Ingreso</Trans>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    <Trans>Personas</Trans>
                  </th>
                  {Array.from({ length: columns }, (_, k) => (
                    <th key={k} className="px-2 py-2 text-center font-semibold whitespace-nowrap">
                      {granularity === 'week' ? t`Sem ${k}` : t`Mes ${k}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.cohort} className="border-b border-line last:border-0">
                    <td className="sticky left-0 bg-surface px-3 py-2 whitespace-nowrap text-ink">
                      {granularity === 'week' ? weekRangeOf(row.cohort) : monthLabel(row.cohort)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink tabular-nums">{row.size}</td>
                    {Array.from({ length: columns }, (_, k) => {
                      const cell = row.cells[k]
                      return (
                        <td key={k} className="px-1 py-1 text-center">
                          {cell ? (
                            <span
                              title={t`${cell.count} de ${row.size}`}
                              className={cn(
                                'block min-w-12 rounded-md px-1.5 py-1 text-xs tabular-nums text-ink',
                                cell.partial && 'italic outline-1 outline-line outline-dashed',
                              )}
                              style={{
                                backgroundColor: `color-mix(in srgb, var(--green) ${String(
                                  Math.round(cell.share * 45),
                                )}%, transparent)`,
                              }}
                            >
                              {formatPercent(cell.share)}
                            </span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
