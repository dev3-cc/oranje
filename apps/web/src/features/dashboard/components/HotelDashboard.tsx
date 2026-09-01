import { Suspense, lazy, type ReactNode } from 'react'

import { useGetHotelOverviewQuery } from '../api/roleDashboardsApi'

import { StatTile } from './ActivityCards'
import { IdentityHeader } from './IdentityHeader'
import { RequisitionMiniList } from './RequisitionMiniList'

const DashboardGlobe = lazy(() =>
  import('./DashboardGlobe').then((module) => ({ default: module.DashboardGlobe })),
)

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import type { SessionUser } from '@/shared/types/session.types'

export function HotelDashboard({ session }: { session: SessionUser }): ReactNode {
  const { data: overview, isLoading, isError, refetch } = useGetHotelOverviewQuery()

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

  return (
    <div className="flex flex-col gap-6">
      <IdentityHeader
        name={session.name}
        subtitle={`${session.roleTitle}${session.hotel ? ` · ${session.hotel.name}` : ''}`}
      >
        <Suspense fallback={null}>
          <DashboardGlobe />
        </Suspense>
      </IdentityHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          value={String(overview.openRequisitions)}
          label="Requisiciones abiertas"
          foot="Autorizadas y en proceso"
          tintClass="bg-o-500/10"
          delay={0.05}
        />
        <StatTile
          value={String(overview.draftRequisitions)}
          label="Por autorizar"
          foot="En elaboración (Verde manzana)"
          tintClass="bg-st-verde-manzana/10"
          delay={0.12}
        />
        <StatTile
          value={String(overview.coveredRequisitions)}
          label="Cubiertas"
          foot="Al 100% (Azul claro)"
          tintClass="bg-st-azul-claro/10"
          delay={0.18}
        />
        <StatTile
          value={String(overview.pendingTimesheets)}
          label="Timesheets sin aprobar"
          foot={IS_DEV_UI ? 'Sin aprobación no se paga (D-09)' : 'Sin aprobación no se paga'}
          tintClass="bg-yellow/15"
          delay={0.24}
        />
      </div>

      <RequisitionMiniList
        title="Requisiciones del hotel"
        subtitle="Las más recientes, con su cobertura"
        requisitions={overview.requisitions}
        emptyLabel="Este hotel no tiene requisiciones todavía."
      />
    </div>
  )
}
