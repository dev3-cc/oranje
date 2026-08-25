import type { ReactNode } from 'react'

import { useGetHotelOverviewQuery } from '../api/roleDashboardsApi'

import { RequisitionMiniList } from './RequisitionMiniList'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
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
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {session.name} · {session.roleTitle}
          {session.hotel ? ` · ${session.hotel.name}` : ''}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(overview.openRequisitions)}
          label="Requisiciones abiertas"
          foot="Autorizadas y en proceso"
        />
        <MetricCard
          value={String(overview.draftRequisitions)}
          label="Por autorizar"
          foot="En elaboración (Verde manzana)"
        />
        <MetricCard
          value={String(overview.coveredRequisitions)}
          label="Cubiertas"
          foot="Al 100% (Azul claro)"
        />
        <MetricCard
          value={String(overview.pendingTimesheets)}
          label="Timesheets sin aprobar"
          foot={IS_DEV_UI ? 'Sin aprobación no se paga (D-09)' : 'Sin aprobación no se paga'}
        />
      </div>

      <RequisitionMiniList
        title="Requisiciones del hotel"
        subtitle="Las más recientes, con su cobertura en slots"
        requisitions={overview.requisitions}
        emptyLabel="Este hotel no tiene requisiciones todavía."
      />
    </div>
  )
}
