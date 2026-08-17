import type { ReactNode } from 'react'

import { useGetDashboardOverviewQuery } from '../api/dashboardApi'
import { StaleProspectList } from '../components/StaleProspectList'
import { StatusFunnel } from '../components/StatusFunnel'

import { MetricCard } from '@/shared/components/MetricCard'
import { formatList, formatPercent } from '@/shared/lib/formatters'

export function DashboardPage(): ReactNode {
  const { data: overview, isLoading, isError } = useGetDashboardOverviewQuery()

  if (isLoading) {
    return <p className="text-sm text-ink-3">Cargando el dashboard…</p>
  }

  if (isError || !overview) {
    return (
      <p className="rounded-lg border border-line bg-surface p-6 text-sm text-red">
        No se pudo cargar el dashboard. Reintenta en unos segundos.
      </p>
    )
  }

  const { owner, scope, metrics } = overview

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1.5 text-sm text-ink-3">
          {owner.name} · {owner.roleLabel} · zonas {formatList(scope.zones)} · {scope.periodLabel}
        </p>
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
    </div>
  )
}
