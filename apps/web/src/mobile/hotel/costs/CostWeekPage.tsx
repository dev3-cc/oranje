import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { useAppHotelCostPositionsQuery } from './costsAppApi'
import { costMoney, GapList, hoursOf, IncompleteBadge, moneyOf, SampleNotice } from './costsParts'

import { LoadError } from '@/shared/components/LoadError'
import { apiErrorMessage } from '@/shared/lib/apiError'
import { formatWeekRange } from '@/shared/lib/formatters'

/**
 * Una semana desglosada por posición: personas, horas regulares y overtime,
 * tarifa del contrato y costo. Si una posición no tiene tarifa se enseñan sus
 * horas y «Información incompleta», sin costo: el total de la semana solo suma
 * lo que se pudo calcular, y lo dice.
 */
export function CostWeekPage(): ReactNode {
  const { t } = useLingui()
  const { weekStart = '' } = useParams()
  const { data, isLoading, error, refetch } = useAppHotelCostPositionsQuery(weekStart)

  const positions = [...(data?.positions ?? [])].sort(
    (a, b) => Number(b.cost ?? -1) - Number(a.cost ?? -1),
  )
  const priced = positions.filter((position) => position.cost !== null)
  const total = priced.reduce((sum, position) => sum + Number(position.cost), 0)
  const isIncomplete = positions.some((position) => position.status === 'INCOMPLETE')

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Link
        to="/hotel/costs"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-o-700"
      >
        <MaterialIcon name="arrow_back" className="text-lg" aria-hidden />
        <Trans>Costos</Trans>
      </Link>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy aria-label={t`Cargando`}>
          <div className="h-28 animate-pulse rounded-2xl bg-surface-2" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
        </div>
      ) : error || !data ? (
        <LoadError
          message={apiErrorMessage(error, { fallback: t`No se pudo cargar la semana.` })}
          onRetry={() => {
            void refetch()
          }}
        />
      ) : (
        <>
          {data.isSample && <SampleNotice />}
          <section className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm text-ink-3">{formatWeekRange(data.weekStart, data.weekEnd)}</p>
            <p className="text-3xl font-bold text-ink tabular-nums">{costMoney(total)}</p>
            <p className="text-xs text-ink-3">
              {isIncomplete ? (
                <Trans>Suma solo las posiciones con tarifa.</Trans>
              ) : (
                <Trans>Todas las posiciones tienen tarifa.</Trans>
              )}
            </p>
          </section>

          <h2 className="text-sm font-semibold text-ink-2">
            <Trans>Por posición</Trans> · {positions.length}
          </h2>
          <ul className="flex flex-col gap-3">
            {positions.map((position) => (
              <li
                key={position.catalogPositionId}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">{position.positionName}</p>
                    <p className="text-xs text-ink-3">
                      {position.departmentName} · <Trans>{position.workers} personas</Trans>
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-ink tabular-nums">
                    {moneyOf(position.cost)}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-ink-3">
                      <Trans>Regulares</Trans>
                    </dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {hoursOf(position.regularMinutes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">
                      <Trans>Overtime</Trans>
                    </dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {hoursOf(position.overtimeMinutes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">
                      <Trans>Tarifa</Trans>
                    </dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {position.billRate === null ? '—' : t`${moneyOf(position.billRate)}/h`}
                    </dd>
                  </div>
                </dl>
                {position.status === 'INCOMPLETE' && (
                  <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
                    <IncompleteBadge />
                    <GapList gaps={position.gaps} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
