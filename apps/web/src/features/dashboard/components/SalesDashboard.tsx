import { Suspense, lazy, type ReactNode } from 'react'

import { useGetDashboardOverviewQuery } from '../api/dashboardApi'

import { MyActivityCard, TeamProgressCard } from './ActivityCards'
import { IdentityHeader } from './IdentityHeader'
import { PipelineFlowCard } from './PipelineFlowCard'
import { StaleProspectList } from './StaleProspectList'
import { StatusFunnel } from './StatusFunnel'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { formatList } from '@/shared/lib/formatters'

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
      <IdentityHeader
        name={owner.name}
        subtitle={`${owner.roleLabel} · zonas ${formatList(scope.zones)} · ${scope.periodLabel}`}
      >
        <Suspense fallback={null}>
          <DashboardGlobe />
        </Suspense>
      </IdentityHeader>

      <MyActivityCard
        stats={{
          openProspects: metrics.openProspects,
          staleProspects: metrics.staleProspects,
          conversionRate: metrics.conversionRate,
          averageConversionDays: metrics.averageConversionDays,
          activeClients: metrics.activeClients,
        }}
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <StatusFunnel buckets={overview.funnel} />
        <StaleProspectList prospects={overview.staleProspects} />
      </div>

      <PipelineFlowCard countByStatus={countByStatus} />
      <TeamProgressCard />
    </div>
  )
}
