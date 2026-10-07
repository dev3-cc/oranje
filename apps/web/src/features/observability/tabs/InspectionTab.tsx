import type { MessageDescriptor } from '@lingui/core'
import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'

import {
  useGetDepartmentMetricsQuery,
  useGetObserverRequisitionsQuery,
} from '../api/observabilityApi'
import { KpiGrid } from '../components/KpiCard'
import { PeopleNotice, PeopleView } from '../components/PeopleView'
import {
  type DepartmentView,
  type SnapshotItem,
  SnapshotStrip,
  TabState,
  TruncatedNotice,
  ViewSwitch,
} from '../components/TabParts'
import {
  ACCIDENT_STATUS_LABEL,
  CONSOLIDATION_STATUS_LABEL,
  inspectionKpis,
} from '../lib/inspectionKpis'
import { inspectionPeople } from '../lib/people'
import type { Period } from '../lib/period'
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

export function InspectionTab({
  period,
  periodLabel,
}: {
  period: Period
  periodLabel: string
}): ReactNode {
  const [view, setView] = useState<DepartmentView>('kpis')
  const metrics = useGetDepartmentMetricsQuery()
  const requisitions = useGetObserverRequisitionsQuery(undefined, { skip: view !== 'people' })
  const items = useCountsOf(metrics.data, 'INSPECTION', ACCIDENT_STATUS_LABEL)
  const source = view === 'kpis' ? metrics : requisitions

  return (
    <div className="flex flex-col gap-4">
      <ViewSwitch value={view} onChange={setView} />
      <TabState
        isLoading={source.isLoading}
        error={source.error}
        onRetry={() => void source.refetch()}
        cards={view === 'kpis' ? 1 : 3}
      >
        {view === 'kpis' ? (
          <>
            <SnapshotStrip items={items} />
            <KpiGrid
              periodLabel={periodLabel}
              kpis={inspectionKpis(metrics.data?.find((item) => item.code === 'INSPECTION'))}
            />
            <p className="text-sm text-ink-3">
              <Trans>
                Accidentes levantados a tiempo, auditorías programadas y visitas a hoteles todavía
                no se pueden medir: el Observador no lee accidentes y el sistema no guarda
                auditorías programadas ni visitas.
              </Trans>
            </p>
          </>
        ) : (
          requisitions.data && (
            <>
              <PeopleNotice>
                <Trans>
                  Solo lo que dicen las requisiciones: las de su zona y las que creó. Sus
                  auditorías, accidentes y visitas no se ven: el Observador no tiene permiso para
                  leerlos. Un inspector sin requisiciones asignadas no aparece.
                </Trans>
              </PeopleNotice>
              {requisitions.data.truncated && <TruncatedNotice />}
              <PeopleView
                columns={4}
                periodLabel={periodLabel}
                rows={inspectionPeople({ period, requisitions: requisitions.data.rows })}
              />
            </>
          )
        )}
      </TabState>
    </div>
  )
}

export function AccountingTab(): ReactNode {
  const [view, setView] = useState<DepartmentView>('kpis')
  const metrics = useGetDepartmentMetricsQuery()
  const items = useCountsOf(metrics.data, 'ACCOUNTING', CONSOLIDATION_STATUS_LABEL)

  return (
    <div className="flex flex-col gap-4">
      <ViewSwitch value={view} onChange={setView} />
      {view === 'kpis' ? (
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
      ) : (
        <PeopleNotice>
          <Trans>
            Todavía no hay actividad por persona en Contabilidad: quién consolidó, validó o pagó
            vive en nómina y facturación, que el Observador no tiene permiso para leer.
          </Trans>
        </PeopleNotice>
      )}
    </div>
  )
}
