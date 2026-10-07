import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import {
  useGetObserverPunchesSinceQuery,
  useGetObserverWorkerHistoriesQuery,
} from '../api/observabilityApi'
import { share, weekRangeOf } from '../lib/cohortFormat'
import {
  addWeeks,
  COHORT_OUTCOME_LABEL,
  COHORT_OUTCOMES,
  type CohortMember,
  cohortDetail,
  EXIT_AREA_LABEL,
  EXIT_AREAS,
  type ExitCause,
  exitCause,
  type WorkerPresence,
} from '../lib/cohorts'
import { localDay } from '../lib/period'

import { WORKER_STATUS_LABEL, type WorkerStatus } from '@/shared/constants/workerStatus'
import { formatDayMonthTime } from '@/shared/lib/formatters'
import type { WorkerApi } from '@/shared/types/apiContract.types'

/** Historiales por consulta: uno por persona que ya no trabaja. */
const MAX_HISTORIES = 300

export function Stat({
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
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-bold text-ink tabular-nums">{value}</span>
        {detail && (
          <span className="text-sm whitespace-nowrap text-ink-3 tabular-nums">{detail}</span>
        )}
      </p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

/** Una lista de barras: etiqueta, «x de N · %» y la barra. */
function Breakdown({
  title,
  total,
  items,
}: {
  title: ReactNode
  total: number
  items: Array<{ key: string; label: string; count: number; detail?: string }>
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <h4 className="text-sm font-semibold text-ink-2">{title}</h4>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{item.label}</span>
              <span className="shrink-0 text-ink tabular-nums">
                <Trans>
                  {item.count} de {total}
                </Trans>{' '}
                · <b>{share(item.count, total)}</b>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-o-300"
                style={{ width: `${String(total === 0 ? 0 : (item.count / total) * 100)}%` }}
              />
            </div>
            {item.detail && <p className="text-xs text-ink-3">{item.detail}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

type Filter = 'all' | 'active' | 'gone'

/**
 * «¿Qué pasó con los que ingresaron?»: la semana elegida en la línea de tiempo
 * o las 12 de su franja, con el desglose por qué pasó y por quién lo originó, y
 * la lista por persona con su cohorte, su % de semanas trabajadas y su motivo.
 */
export function CohortSection({
  presence,
  currentWeek,
  workers,
  selected,
  band,
  isBand,
  onBandChange,
  hotelName,
}: {
  presence: Map<string, WorkerPresence>
  currentWeek: string
  workers: Map<string, WorkerApi>
  selected: string
  /** Las 12 semanas alrededor de la elegida. */
  band: string[]
  isBand: boolean
  onBandChange: (isBand: boolean) => void
  hotelName: string | null
}): ReactNode {
  const { i18n, t } = useLingui()
  const [filter, setFilter] = useState<Filter>('all')
  const isAll = isBand
  const weeks = isAll ? band : [selected]
  const detail = cohortDetail(presence, weeks, currentWeek, workers)
  const size = detail.members.length
  const bandFrom = band[band.length - 1] ?? selected
  const bandTo = band[0] ?? selected

  /* «¿Regresaron el lunes?»: los ponches de ese lunes, solo para una semana
     y si cae en las dos más recientes (la ventana de ponches). */
  const nextMonday = isAll ? currentWeek : addWeeks(selected, 1)
  const mondayInReach =
    !isAll && nextMonday <= currentWeek && nextMonday >= addWeeks(currentWeek, -1)
  const [year, month, day] = nextMonday.split('-').map(Number) as [number, number, number]
  const punches = useGetObserverPunchesSinceQuery(new Date(year, month - 1, day).toISOString(), {
    skip: !mondayInReach || size === 0,
  })
  const memberIds = new Set(detail.members.map((member) => member.workerId))
  const backMonday =
    mondayInReach && punches.data
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

  /* El motivo y quién lo originó: el historial de cada persona que ya no
     trabaja (una llamada por persona, con tope). */
  const gone = detail.members.filter((member) => member.outcome !== 'ACTIVE')
  const historyIds = gone
    .map((member) => member.workerId)
    .sort()
    .slice(0, MAX_HISTORIES)
  const histories = useGetObserverWorkerHistoriesQuery(historyIds, {
    skip: historyIds.length === 0,
  })
  const causeOf = (member: CohortMember): ExitCause | null =>
    member.outcome === 'ACTIVE' || !histories.data
      ? null
      : exitCause(member.stateCode, histories.data[member.workerId] ?? [])

  const outcomeItems = COHORT_OUTCOMES.flatMap((outcome) => {
    const group = gone.filter((member) => member.outcome === outcome)
    if (group.length === 0) return []
    const reasons = new Map<string, number>()
    for (const member of group) {
      const cause = causeOf(member)
      const reason = cause?.reason ?? (cause?.note ? i18n._(cause.note) : null)
      if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    }
    return [
      {
        key: outcome,
        label: i18n._(COHORT_OUTCOME_LABEL[outcome]),
        count: group.length,
        detail: [...reasons].map(([reason, count]) => `${reason}: ${String(count)}`).join(' · '),
      },
    ]
  })

  const areaItems = histories.data
    ? EXIT_AREAS.flatMap((area) => {
        const count = gone.filter((member) => causeOf(member)?.area === area).length
        return count ? [{ key: area, label: i18n._(EXIT_AREA_LABEL[area]), count }] : []
      })
    : []

  const visible = detail.members.filter((member) =>
    filter === 'all'
      ? true
      : filter === 'active'
        ? member.outcome === 'ACTIVE'
        : member.outcome !== 'ACTIVE',
  )

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
            <Trans>¿Qué pasó con los que ingresaron?</Trans>
          </p>
          <h3 className="text-xl font-bold text-ink">
            {isAll ? (
              <Trans>
                De {weekRangeOf(bandFrom)} a {weekRangeOf(bandTo)}
              </Trans>
            ) : (
              <Trans>Semana del {weekRangeOf(selected)}</Trans>
            )}
            {hotelName && <span className="font-semibold text-ink-2"> · {hotelName}</span>}
          </h3>
        </div>
        <div
          role="radiogroup"
          aria-label={t`Qué semanas ver`}
          className="inline-flex rounded-xl border border-line bg-surface p-1"
        >
          {(
            [
              [false, t`Solo esta semana`],
              [true, t`Las ${band.length} semanas alrededor`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={isAll === value}
              onClick={() => {
                onBandChange(value)
              }}
              className={cn(
                'min-h-8 rounded-lg px-3 text-sm font-medium',
                isAll === value ? 'bg-o-50 text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
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
                isAll ? (
                  <Trans>Elige una semana para verlo.</Trans>
                ) : !mondayInReach ? (
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
              value={share(detail.returned, detail.eligible)}
              detail={
                detail.eligible > 0 && (
                  <Trans>
                    {detail.returned} de {detail.eligible}
                  </Trans>
                )
              }
              hint={
                detail.eligible === 0 ? (
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
              hint={<Trans>Ponchó esta semana o la pasada, después de su semana de ingreso.</Trans>}
            />
          </div>

          {gone.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
              <Trans>
                Todos los de esta cohorte siguen trabajando: no hay salidas que desglosar.
              </Trans>
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Breakdown
                title={<Trans>Qué pasó con quienes ya no trabajan</Trans>}
                total={gone.length}
                items={outcomeItems}
              />
              {histories.isLoading ? (
                <div className="h-40 animate-pulse rounded-xl bg-surface-3" />
              ) : (
                <Breakdown
                  title={<Trans>Quién originó la salida</Trans>}
                  total={gone.length}
                  items={areaItems}
                />
              )}
            </div>
          )}
          {gone.length > MAX_HISTORIES && (
            <p className="text-xs text-ink-3">
              <Trans>
                El motivo y quién lo originó se leen de las primeras {MAX_HISTORIES} personas que ya
                no trabajan. Elige una sola semana para verlo de todas.
              </Trans>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink-2">
              <Trans>Por persona</Trans> · {visible.length}
            </h4>
            <div
              role="radiogroup"
              aria-label={t`Mostrar`}
              className="inline-flex rounded-xl border border-line bg-surface p-1"
            >
              {(
                [
                  ['all', t`Todos`],
                  ['active', t`Siguen trabajando`],
                  ['gone', t`Ya no trabajan`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={filter === value}
                  onClick={() => {
                    setFilter(value)
                  }}
                  className={cn(
                    'min-h-8 rounded-lg px-3 text-sm font-medium',
                    filter === value ? 'bg-o-50 text-ink' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="px-3 py-2 font-semibold">
                    <Trans>Colaborador</Trans>
                  </th>
                  <th className="px-3 py-2 font-semibold">
                    <Trans>Semana de ingreso</Trans>
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
                  <th className="min-w-56 px-3 py-2 font-semibold">
                    <Trans>Qué pasó y motivo</Trans>
                  </th>
                  <th className="min-w-52 px-3 py-2 font-semibold">
                    <Trans>Quién lo originó</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((member) => {
                  const cause = causeOf(member)
                  const isActive = member.outcome === 'ACTIVE'
                  return (
                    <tr
                      key={member.workerId}
                      className="border-b border-line align-top last:border-0"
                    >
                      <td className="min-w-48 px-3 py-2">
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
                      <td className="px-3 py-2 whitespace-nowrap text-ink-2 tabular-nums">
                        {weekRangeOf(member.cohortWeek)}
                      </td>
                      <td className="px-3 py-2 text-ink-2">{member.hotels.join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        <span className="text-ink">
                          <Trans>
                            {member.weeksWorked} de {member.weeksPossible}
                          </Trans>
                        </span>{' '}
                        <b className="text-ink">
                          {share(member.weeksWorked, member.weeksPossible)}
                        </b>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-ink-2 tabular-nums">
                        {weekRangeOf(member.lastWeek)}
                      </td>
                      <td className="px-3 py-2">
                        <p className={isActive ? 'text-ink-2' : 'font-medium text-ink'}>
                          {i18n._(COHORT_OUTCOME_LABEL[member.outcome])}
                        </p>
                        {!isActive && (
                          <p className="text-xs text-ink-3">
                            {histories.isLoading
                              ? '…'
                              : (cause?.reason ?? (cause?.note ? i18n._(cause.note) : null))}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-2">
                        {isActive || !cause ? (
                          isActive ? (
                            '—'
                          ) : (
                            '…'
                          )
                        ) : (
                          <>
                            <span className="font-medium text-ink">
                              {i18n._(EXIT_AREA_LABEL[cause.area])}
                            </span>
                            {cause.by && <p className="text-xs text-ink-3">{cause.by}</p>}
                            {cause.at && (
                              <p className="text-xs text-ink-3 tabular-nums">
                                {formatDayMonthTime(cause.at)}
                              </p>
                            )}
                          </>
                        )}
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
  )
}
