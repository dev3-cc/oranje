import { Suspense, lazy, type ReactNode } from 'react'

import { useGetDashboardOverviewQuery } from '../api/dashboardApi'

import { PipelineFlowCard } from './PipelineFlowCard'
import { StaleProspectList } from './StaleProspectList'
import { StatusFunnel } from './StatusFunnel'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import { formatList, formatPercent } from '@/shared/lib/formatters'

const DashboardGlobe = lazy(() =>
  import('./DashboardGlobe').then((module) => ({ default: module.DashboardGlobe })),
)

export function SalesDashboard(): ReactNode {
  const { data: overview, isLoading, isError, refetch } = useGetDashboardOverviewQuery()

  if (isLoading) {
    return <CardGridSkeleton cards={6} className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" />
  }

  if (isError || !overview) {
    return (
      <LoadError
        message="No se pudo cargar el dashboard. Reintenta en unos segundos."
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const { owner, scope, metrics } = overview

  const countByStatus = Object.fromEntries(
    overview.funnel.map((bucket) => [bucket.status, bucket.count]),
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-2xl bg-surface px-6 py-7 shadow-md sm:px-8">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {owner.name} · {owner.roleLabel} · zonas {formatList(scope.zones)} · {scope.periodLabel}
          </p>
        </div>
        <Suspense fallback={null}>
          <DashboardGlobe />
        </Suspense>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(metrics.openProspects)}
          label="Prospectos abiertos"
          foot={`${metrics.staleProspects} sin actividad 7+ días`}
        />
        <MetricCard
          value={formatPercent(metrics.conversionRate)}
          label="Tasa de conversión"
          foot="Naranja / ciclos cerrados"
        />
        <MetricCard
          value={`${metrics.averageConversionDays} d`}
          label="Tiempo promedio de conversión"
          foot="Gris → Naranja"
        />
        <MetricCard
          value={String(metrics.activeClients)}
          label="Clientes activos"
          foot="Habilitados para requisiciones"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <StatusFunnel buckets={overview.funnel} />
        <StaleProspectList prospects={overview.staleProspects} />
      </div>

      <PipelineFlowCard countByStatus={countByStatus} />
    </div>
  )
}
