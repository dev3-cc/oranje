import type { MessageDescriptor } from '@lingui/core'
import { Trans, useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'

import { useGetDepartmentMetricsQuery } from '../api/observabilityApi'
import { KpiGrid } from '../components/KpiCard'
import { type SnapshotItem, SnapshotStrip, TabState } from '../components/TabParts'
import {
  ACCIDENT_STATUS_LABEL,
  CONSOLIDATION_STATUS_LABEL,
  inspectionKpis,
} from '../lib/inspectionKpis'
import type { DepartmentCode, DepartmentMetric } from '../types/observability.types'

function useCountsOf(
  metrics: DepartmentMetric[] | undefined,
  code: DepartmentCode,
  labels: Record<string, MessageDescriptor>,
): SnapshotItem[] {
  const { i18n } = useLingui()
  const metric = metrics?.find((item) => item.code === code)
  return (metric?.counts ?? []).map((count) => {
    const label = labels[count.label]
    return { key: count.label, label: label ? i18n._(label) : count.label, count: count.count }
  })
}

export function InspectionTab({ periodLabel }: { periodLabel: string }): ReactNode {
  const metrics = useGetDepartmentMetricsQuery()
  const items = useCountsOf(metrics.data, 'INSPECTION', ACCIDENT_STATUS_LABEL)

  return (
    <TabState
      isLoading={metrics.isLoading}
      error={metrics.error}
      onRetry={() => void metrics.refetch()}
      cards={1}
    >
      <SnapshotStrip items={items} />
      <KpiGrid
        periodLabel={periodLabel}
        kpis={inspectionKpis(metrics.data?.find((item) => item.code === 'INSPECTION'))}
      />
      <p className="text-sm text-ink-3">
        <Trans>
          Accidentes levantados a tiempo, auditorías programadas y visitas a hoteles todavía no se
          pueden medir: el Observador no lee accidentes y el sistema no guarda auditorías
          programadas ni visitas.
        </Trans>
      </p>
    </TabState>
  )
}

export function AccountingTab(): ReactNode {
  const metrics = useGetDepartmentMetricsQuery()
  const items = useCountsOf(metrics.data, 'ACCOUNTING', CONSOLIDATION_STATUS_LABEL)

  return (
    <TabState
      isLoading={metrics.isLoading}
      error={metrics.error}
      onRetry={() => void metrics.refetch()}
      cards={1}
    >
      <SnapshotStrip items={items} />
      <p className="text-sm text-ink-3">
        <Trans>
          Solo los consolidados de nómina por estado. Los KPIs de Contabilidad (consolidados a
          tiempo, días a invoice, cobro, fuga de horas) necesitan que el Observador pueda leer
          nómina y facturación.
        </Trans>
      </p>
    </TabState>
  )
}
