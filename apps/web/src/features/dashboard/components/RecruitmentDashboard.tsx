import type { ReactNode } from 'react'

import { useGetRecruitmentOverviewQuery } from '../api/roleDashboardsApi'

import { RequisitionMiniList } from './RequisitionMiniList'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { FoldText } from '@/shared/components/FoldText'
import { LoadError } from '@/shared/components/LoadError'
import { MetricCard } from '@/shared/components/MetricCard'
import type { SessionUser } from '@/shared/types/session.types'

export function RecruitmentDashboard({ session }: { session: SessionUser }): ReactNode {
  const { data: overview, isLoading, isError, refetch } = useGetRecruitmentOverviewQuery()

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
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          <FoldText text="Dashboard" />
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {session.name} · {session.roleTitle}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          value={String(overview.poolTotal)}
          label="Colaboradores en el Pool"
          foot={`${overview.poolPendingValidation} en Blanco, por validar`}
        />
        <MetricCard
          value={String(overview.poolAvailable)}
          label="Disponibles"
          foot="Verde fuerte, sin veto vigente"
        />
        <MetricCard
          value={String(overview.queueOpen)}
          label="Requisiciones en cola"
          foot="Autorizadas, sin tomar (Self-Pick)"
        />
        <MetricCard
          value={String(overview.queueInProgress)}
          label="En proceso"
          foot="Tomadas por una reclutadora"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-ink">Pool por estado</h2>
          <p className="mt-0.5 text-sm text-ink-3">Semáforo del Colaborador · hoy</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {overview.poolByState.map((state) => (
              <li key={state.code} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-ink-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: state.color }}
                  />
                  {state.name}
                </span>
                <span className="text-sm font-semibold text-ink">{state.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <RequisitionMiniList
          title="Cola del Self-Pick"
          subtitle="Autorizadas y en proceso; los borradores no se muestran a Reclutamiento"
          requisitions={overview.queue}
          emptyLabel="No hay requisiciones autorizadas por ahora."
        />
      </div>
    </div>
  )
}
