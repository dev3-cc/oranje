import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn, MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import {
  type Kpi,
  type KpiFormat,
  type KpiScope,
  type KpiStatus,
  KPI_STATUS_CLASS,
  KPI_TARGETS,
  kpiStatus,
} from '../lib/kpi'

import { formatDurationHuman, formatPercent } from '@/shared/lib/formatters'

const STATUS_LABEL: Record<KpiStatus, MessageDescriptor> = {
  ON_TARGET: msg`En meta`,
  OFF_TARGET: msg`Fuera de meta`,
  NO_TARGET: msg`Sin meta`,
  NO_DATA: msg`Sin datos`,
}

const SCOPE_LABEL: Record<Exclude<KpiScope, 'PERIOD'>, MessageDescriptor> = {
  NOW: msg`Ahora`,
  ALL_TIME: msg`Histórico`,
}

function useFormatValue(): (value: number, format: KpiFormat) => string {
  const { t } = useLingui()
  return (value, format) => {
    if (format === 'percent') return formatPercent(value)
    if (format === 'hours') return formatDurationHuman(Math.round(value * 10) / 10)
    if (format === 'days') {
      const days = Math.round(value * 10) / 10
      return t`${days} días`
    }
    return String(value)
  }
}

/**
 * Un KPI: el número, su estado contra la meta de ejemplo, y qué mide. Sin
 * número dice por qué (Sin datos / Sin fuente), sin color.
 */
export function KpiCard({ kpi, periodLabel }: { kpi: Kpi; periodLabel: string }): ReactNode {
  const { i18n, t } = useLingui()
  const formatValue = useFormatValue()
  const status = kpiStatus(kpi)
  const target = KPI_TARGETS[kpi.id]
  const statusLabel = kpi.empty === 'NO_SOURCE' ? t`Sin fuente` : i18n._(STATUS_LABEL[status])

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-surface p-4',
        KPI_STATUS_CLASS[status].card,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-2">{i18n._(kpi.label)}</h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
            KPI_STATUS_CLASS[status].chip,
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-ink tabular-nums">
          {kpi.value === null ? '—' : formatValue(kpi.value, kpi.format)}
        </p>
        {kpi.ratio && (
          <p className="text-sm text-ink-3 tabular-nums">
            <Trans>
              {kpi.ratio.part} de {kpi.ratio.whole}
            </Trans>
          </p>
        )}
      </div>

      <p className="text-xs text-ink-3">{i18n._(kpi.hint)}</p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-ink-2">
          {kpi.scope === 'PERIOD' ? periodLabel : i18n._(SCOPE_LABEL[kpi.scope])}
        </span>
        {target && (
          <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-ink-2">
            {target.direction === 'atLeast' ? '≥' : '≤'} {formatValue(target.value, kpi.format)}
            {target.isExample && (
              <>
                {' · '}
                <Trans>meta de ejemplo</Trans>
              </>
            )}
          </span>
        )}
        {kpi.approximate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow/25 px-2 py-0.5 text-ink">
            <MaterialIcon name="info" className="text-sm" aria-hidden />
            <Trans>Aproximado</Trans>
          </span>
        )}
      </div>
    </article>
  )
}

export function KpiGrid({ kpis, periodLabel }: { kpis: Kpi[]; periodLabel: string }): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} periodLabel={periodLabel} />
      ))}
    </div>
  )
}
