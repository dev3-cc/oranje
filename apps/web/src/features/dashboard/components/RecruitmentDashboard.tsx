import type { ReactNode } from 'react'

import { useGetRecruitmentOverviewQuery } from '../api/roleDashboardsApi'

import { StatTile } from './ActivityCards'
import { IdentityHeader } from './IdentityHeader'
import { RequisitionMiniList } from './RequisitionMiniList'

import { CardGridSkeleton } from '@/shared/components/CardGridSkeleton'
import { LoadError } from '@/shared/components/LoadError'
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
      <IdentityHeader name={session.name} subtitle={session.roleTitle} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          value={String(overview.poolTotal)}
          label="Colaboradores en el Pool"
          foot={`${String(overview.poolPendingValidation)} en Blanco, por validar`}
          tintClass="bg-o-500/10"
          delay={0.05}
        />
        <StatTile
          value={String(overview.poolAvailable)}
          label="Disponibles"
          foot="Verde fuerte, sin veto vigente"
          tintClass="bg-st-verde/10"
          delay={0.12}
        />
        <StatTile
          value={String(overview.queueOpen)}
          label="Requisiciones en cola"
          foot="Autorizadas, sin tomar (Self-Pick)"
          tintClass="bg-st-azul-claro/10"
          delay={0.18}
        />
        <StatTile
          value={String(overview.queueInProgress)}
          label="En proceso"
          foot="Tomadas por una Reclutadora"
          tintClass="bg-surface-2"
          delay={0.24}
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
