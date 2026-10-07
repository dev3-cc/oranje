import { Trans } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useAppHotelCostWeeksQuery } from '../costs/costsAppApi'
import { IncompleteBadge, moneyOf } from '../costs/costsParts'

import { useCan } from '@/shared/hooks/useCan'

/** Quién ve costos: el Manager General (todo el hotel) y el de Área (su departamento). */
export function useCanSeeCosts(): boolean {
  const can = useCan()
  return can('dashboard:read_all') || can('dashboard:read_department')
}

/**
 * El KPI de costo en el Inicio: cuánto va la semana actual (estimado con lo
 * ponchado) y lo aprobado de la anterior. Lleva a la sección de Costos.
 */
export function WeekCostCard(): ReactNode {
  const canSeeCosts = useCanSeeCosts()
  const { data } = useAppHotelCostWeeksQuery(undefined, { skip: !canSeeCosts })
  if (!canSeeCosts || !data) return null

  const sorted = [...data.weeks].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  const current = sorted.find((week) => week.isCurrent) ?? null
  const previous = sorted.find((week) => !week.isCurrent) ?? null

  return (
    <Link
      to="/hotel/costs"
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 active:bg-surface-2"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          <Trans>Costo de esta semana</Trans>
        </p>
        <MaterialIcon name="chevron_right" className="text-xl text-ink-3" aria-hidden />
      </div>
      <p className="text-2xl font-semibold text-ink tabular-nums">
        {moneyOf(current?.estimatedCost ?? null)}
      </p>
      <p className="text-xs text-ink-3">
        {previous ? (
          <Trans>Estimado al día · semana pasada {moneyOf(previous.approvedCost)} aprobado</Trans>
        ) : (
          <Trans>Estimado al día</Trans>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {current?.status === 'INCOMPLETE' && <IncompleteBadge />}
        {data.isSample && (
          <span className="inline-flex items-center gap-1 rounded-full bg-o-50 px-2 py-0.5 text-xs font-semibold text-o-900">
            <MaterialIcon name="science" className="text-sm" aria-hidden />
            <Trans>Datos de ejemplo</Trans>
          </span>
        )}
      </div>
    </Link>
  )
}
