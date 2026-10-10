import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useAppHotelCostWeeksQuery } from './costsAppApi'
import { costMoney, GapList, hoursOf, IncompleteBadge, moneyOf, SampleNotice } from './costsParts'

import { LoadError } from '@/shared/components/LoadError'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatWeekRange } from '@/shared/lib/formatters'

/**
 * Costos del hotel en la app: cuánto va la semana actual y cuánto fue cada
 * semana trabajada. El costo es lo que el hotel le paga a Oranje (tarifa del
 * contrato × horas, overtime con su multiplicador): el mismo cálculo que la
 * factura. Donde falta un dato se dice «Información incompleta» y por qué —
 * nunca un número inventado.
 *
 * El Manager General ve todo el hotel; el de Área, su departamento (lo recorta
 * el API).
 */
export function CostsPage(): ReactNode {
  const { t } = useLingui()
  const { data, isLoading, error, refetch } = useAppHotelCostWeeksQuery()

  const weeks = [...(data?.weeks ?? [])].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  const current = weeks.find((week) => week.isCurrent) ?? null
  const past = weeks.filter((week) => !week.isCurrent)
  /* El total general: lo aprobado de las semanas ya cerradas. */
  const closedWithCost = past.filter((week) => week.approvedCost !== null)
  const total = closedWithCost.reduce((sum, week) => sum + Number(week.approvedCost), 0)
  const average = closedWithCost.length === 0 ? null : total / closedWithCost.length
  const maxCost = Math.max(...weeks.map((week) => Number(week.estimatedCost ?? 0)), 1)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Link
        to="/hotel"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-o-700"
      >
        <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
        <Trans>Inicio</Trans>
      </Link>
      <h1 className="text-xl font-bold text-ink">
        <Trans>Costos</Trans>
      </h1>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy aria-label={t`Cargando`}>
          <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
          <div className="h-56 animate-pulse rounded-2xl bg-surface-2" />
        </div>
      ) : error ? (
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudieron cargar los costos.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : (
        <>
          {data?.isSample && <SampleNotice />}

          {current && (
            <Link
              to={`/hotel/costs/${current.weekStart}`}
              className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-surface active:opacity-90"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-surface/70">
                    <Trans>Esta semana</Trans>
                  </p>
                  <p className="text-xs text-surface/60">
                    {formatWeekRange(current.weekStart, current.weekEnd)}
                  </p>
                </div>
                <MaterialIcon
                  name="chevron_right"
                  className="text-2xl text-surface/60"
                  aria-hidden
                />
              </div>
              <p className="text-3xl font-bold tabular-nums">{moneyOf(current.estimatedCost)}</p>
              <p className="text-xs text-surface/70">
                <Trans>
                  Estimado con lo ponchado hasta hoy · {hoursOf(current.regularMinutes)} regulares ·{' '}
                  {hoursOf(current.overtimeMinutes)} overtime
                </Trans>
              </p>
              {current.status === 'INCOMPLETE' && (
                <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-ink">
                  <IncompleteBadge />
                  <GapList gaps={current.gaps} />
                </div>
              )}
            </Link>
          )}

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <dt className="text-xs text-ink-3">
                <Trans>Total de las semanas cerradas</Trans>
              </dt>
              <dd className="text-xl font-semibold text-ink tabular-nums">
                {closedWithCost.length === 0 ? '—' : costMoney(total)}
              </dd>
              <dd className="text-xs text-ink-3">
                <Trans>{closedWithCost.length} semanas aprobadas</Trans>
              </dd>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <dt className="text-xs text-ink-3">
                <Trans>Promedio por semana</Trans>
              </dt>
              <dd className="text-xl font-semibold text-ink tabular-nums">
                {average === null ? '—' : costMoney(average)}
              </dd>
              <dd className="text-xs text-ink-3">
                <Trans>Por semana trabajada</Trans>
              </dd>
            </div>
          </dl>

          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">
              <Trans>Por semana</Trans>
            </h2>
            {weeks.length === 0 ? (
              <p className="text-sm text-ink-3">
                <Trans>Todavía no hay semanas trabajadas.</Trans>
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {weeks.map((week) => (
                  <li key={week.weekStart}>
                    <Link
                      to={`/hotel/costs/${week.weekStart}`}
                      className="flex flex-col gap-1.5 rounded-xl px-1 py-2 active:bg-surface-2"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-ink-2">
                          {formatWeekRange(week.weekStart, week.weekEnd)}
                          {week.isCurrent && (
                            <span className="ml-1.5 text-xs font-semibold text-o-700">
                              <Trans>en curso</Trans>
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-ink tabular-nums">
                          {moneyOf(week.isCurrent ? week.estimatedCost : week.approvedCost)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              week.isCurrent ? 'bg-o-300' : 'bg-o-500',
                            )}
                            style={{
                              width: `${String(Math.round((Number(week.estimatedCost ?? 0) / maxCost) * 100))}%`,
                            }}
                          />
                        </div>
                        {week.status === 'INCOMPLETE' && (
                          <MaterialIcon
                            name="info"
                            className="text-base text-o-700"
                            aria-label={t`Información incompleta`}
                          />
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-ink-3">
            <Trans>
              El costo es lo que el hotel paga a Oranje: tarifa del contrato por hora trabajada, y
              el overtime con su recargo. Es el mismo cálculo de la factura.
            </Trans>
          </p>
        </>
      )}
    </div>
  )
}
