import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useAppTimesheetWeekQuery, type AppTimesheetRow } from './timesheetAppApi'
import { WeekDots, WeekStatusChip } from './timesheetParts'

import personajeCronograma from '@/assets/ilustrations/personaje-cronograma.svg'
import { EmptyState } from '@/shared/components/EmptyState'
import { LoadError } from '@/shared/components/LoadError'
import type { TimesheetWeekStatus } from '@/shared/constants/timesheetStatus'
import { useCan } from '@/shared/hooks/useCan'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatHours, formatWeekRange } from '@/shared/lib/formatters'

type Filter = 'all' | TimesheetWeekStatus

/**
 * El Timesheet del hotel en la app: una semana, una tarjeta por persona con
 * sus siete días en puntos, sus horas y el estado de la semana. El Manager
 * General ve todo el hotel —el resumen de arriba es su «Timesheet Global»—;
 * el de Área y el Supervisor, su departamento (lo recorta el API).
 *
 * La semana elegida viaja en `?week=` para que volver del detalle no la pierda.
 */
export function TimesheetPage(): ReactNode {
  const { t } = useLingui()
  const can = useCan()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedWeek = searchParams.get('week')
  const { data, isLoading, error, refetch, isFetching } = useAppTimesheetWeekQuery(requestedWeek)
  /*
   * `null` = sin elegir: quien aprueba arranca en «Por aprobar» SOLO si hay
   * alguna; si no, en «Todas». Arrancar en un filtro vacío decía «No hay
   * semanas» con seis abiertas en la lista (visto con datos reales).
   */
  const [chosenFilter, setFilter] = useState<Filter | null>(null)

  const rows = data?.rows ?? []
  const weeks = data?.availableWeeks ?? []
  const weekIndex = data?.weekStart ? weeks.indexOf(data.weekStart) : -1
  const hasPending = rows.some((row) => row.status === 'PENDING_APPROVAL')
  const filter: Filter =
    chosenFilter ?? (can('timesheet:approve_hours') && hasPending ? 'PENDING_APPROVAL' : 'all')
  const visible = rows.filter((row) => filter === 'all' || row.status === filter)
  const countOf = (status: TimesheetWeekStatus): number =>
    rows.filter((row) => row.status === status).length

  function goToWeek(index: number): void {
    const week = weeks[index]
    if (week) setSearchParams({ week }, { replace: true })
  }

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: t`Todas`, count: rows.length },
    { id: 'OPEN', label: t`Abiertas`, count: countOf('OPEN') },
    { id: 'PENDING_APPROVAL', label: t`Por aprobar`, count: countOf('PENDING_APPROVAL') },
    { id: 'APPROVED', label: t`Aprobadas`, count: countOf('APPROVED') },
  ]

  const totalHours = rows.reduce((total, row) => total + row.totalHours, 0)
  const anomalies = rows.reduce((total, row) => total + row.pendingAnomalies, 0)
  const weekEnd = rows[0]?.weekEnd ?? data?.weekStart ?? ''

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="text-xl font-bold text-ink">
        <Trans>Timesheet</Trans>
      </h1>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy aria-label={t`Cargando`}>
          <div className="h-12 animate-pulse rounded-2xl bg-surface-2" />
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : error ? (
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudo cargar el Timesheet.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : data?.weekStart === null || data === undefined ? (
        <EmptyState
          image={personajeCronograma}
          title={t`Sin semanas todavía`}
          text={t`Cuando tu personal ponche, sus semanas aparecen aquí.`}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-2">
            <button
              type="button"
              aria-label={t`Semana anterior`}
              disabled={weekIndex <= 0}
              onClick={() => {
                goToWeek(weekIndex - 1)
              }}
              className="flex size-11 items-center justify-center rounded-full text-ink-2 active:bg-surface disabled:opacity-30"
            >
              <MaterialIcon name="chevron_left" className="text-2xl" aria-hidden />
            </button>
            <p className="text-sm font-semibold text-ink">
              {formatWeekRange(data.weekStart, weekEnd)}
            </p>
            <button
              type="button"
              aria-label={t`Semana siguiente`}
              disabled={weekIndex >= weeks.length - 1}
              onClick={() => {
                goToWeek(weekIndex + 1)
              }}
              className="flex size-11 items-center justify-center rounded-full text-ink-2 active:bg-surface disabled:opacity-30"
            >
              <MaterialIcon name="chevron_right" className="text-2xl" aria-hidden />
            </button>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-line bg-surface p-3">
              <dd className="text-lg font-semibold text-ink tabular-nums">
                {formatHours(totalHours)}
              </dd>
              <dt className="text-[11px] text-ink-3">
                <Trans>Horas de la semana</Trans>
              </dt>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3">
              <dd className="text-lg font-semibold text-ink tabular-nums">
                {countOf('PENDING_APPROVAL')}
              </dd>
              <dt className="text-[11px] text-ink-3">
                <Trans>Por aprobar</Trans>
              </dt>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3">
              <dd
                className={cn(
                  'text-lg font-semibold tabular-nums',
                  anomalies > 0 ? 'text-red' : 'text-ink-3',
                )}
              >
                {anomalies}
              </dd>
              <dt className="text-[11px] text-ink-3">
                <Trans>Días con anomalía</Trans>
              </dt>
            </div>
          </dl>

          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => {
                  setFilter(item.id)
                }}
                className={cn(
                  'flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap',
                  filter === item.id
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface text-ink-2',
                )}
              >
                {item.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    filter === item.id ? 'bg-surface/20' : 'bg-surface-2',
                  )}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 p-4 text-center text-sm text-ink-3">
              <Trans>No hay semanas en este filtro.</Trans>
            </p>
          ) : (
            <ul className={cn('flex flex-col gap-3', isFetching && 'opacity-70')}>
              {visible.map((row: AppTimesheetRow) => (
                <li key={row.timesheetId}>
                  <Link
                    to={`/hotel/timesheet/${row.timesheetId}`}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
                  >
                    {/* Folio y estado arriba; el nombre abajo, a todo lo ancho: un chip
                        largo («Enviada a aprobación») ya no lo corta. */}
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs text-ink-3">{row.requisitionNumber}</p>
                      <WeekStatusChip status={row.status} />
                    </div>
                    <p className="-mt-1 text-base font-semibold text-ink">{row.workerName}</p>
                    <WeekDots days={row.days} />
                    <div className="flex items-center justify-between text-xs text-ink-2">
                      <span className="font-semibold tabular-nums">
                        {formatHours(row.totalHours)}
                      </span>
                      {row.pendingAnomalies > 0 && (
                        <span className="font-semibold text-red">
                          <Trans>{row.pendingAnomalies} con anomalía</Trans>
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
