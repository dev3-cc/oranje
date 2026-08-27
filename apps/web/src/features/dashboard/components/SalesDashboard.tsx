import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { Suspense, lazy, type ReactNode } from 'react'

import { useGetDashboardOverviewQuery } from '../api/dashboardApi'

import { MyActivityCard, TeamProgressCard } from './ActivityCards'
import { PipelineFlowCard } from './PipelineFlowCard'
import { StaleProspectList } from './StaleProspectList'
import { StatusFunnel } from './StatusFunnel'

import { useGetSessionQuery } from '@/app/sessionApi'
import auraAnimation from '@/assets/dashboard/oranje-aura.lottie'
import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { formatList } from '@/shared/lib/formatters'

const DashboardGlobe = lazy(() =>
  import('./DashboardGlobe').then((module) => ({ default: module.DashboardGlobe })),
)

export function SalesDashboard(): ReactNode {
  const { data: overview, isLoading, isError, refetch } = useGetDashboardOverviewQuery()
  const { data: session } = useGetSessionQuery()

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
      <header className="relative overflow-hidden rounded-none bg-transparent px-0 py-2 shadow-none sm:rounded-2xl sm:bg-surface sm:px-8 sm:py-7 sm:shadow-md">
        {/* En móvil la FOTO va sola hasta arriba, centrada (la referencia);
            en escritorio, avatar y nombre en fila. El título ES la persona. */}
        <div className="relative z-10 flex max-w-xl flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
          {/* El aura Lottie vive DETRÁS del avatar, centrada y sin atrapar clics. */}
          <div className="relative flex size-32 shrink-0 items-center justify-center sm:size-24">
            <DotLottieReact
              src={auraAnimation}
              loop
              autoplay
              className="pointer-events-none absolute inset-0 size-full"
            />
            {session?.photoUrl ? (
              <img
                src={session.photoUrl}
                alt=""
                aria-hidden
                className="relative size-20 rounded-full object-cover shadow-md sm:size-16"
              />
            ) : (
              <span
                aria-hidden
                className="relative flex size-20 items-center justify-center rounded-full bg-o-500/15 text-2xl font-bold text-o-700 sm:size-16"
              >
                {owner.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word.charAt(0))
                  .join('')
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              <FoldText text={owner.name} />
            </h1>
            <p className="mt-1.5 text-sm text-ink-3">
              {owner.roleLabel} · zonas {formatList(scope.zones)} · {scope.periodLabel}
            </p>
          </div>
        </div>
        <Suspense fallback={null}>
          <DashboardGlobe />
        </Suspense>
      </header>

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
