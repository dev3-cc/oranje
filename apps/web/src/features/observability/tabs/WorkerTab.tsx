import { type ReactNode, useState } from 'react'

import {
  useGetObserverPunchesSinceQuery,
  useGetObserverRequisitionsQuery,
  useGetObserverTimesheetHistoryQuery,
  useGetObserverWorkersQuery,
} from '../api/observabilityApi'
import { CohortsView } from '../components/CohortsView'
import { KpiGrid } from '../components/KpiCard'
import {
  type DepartmentView,
  type SnapshotItem,
  SnapshotStrip,
  TabState,
  TruncatedNotice,
  ViewSwitch,
} from '../components/TabParts'
import { type Period } from '../lib/period'
import { workerKpis } from '../lib/workerKpis'

import { WORKER_STATUS_LABEL, WORKER_STATUSES } from '@/shared/constants/workerStatus'
import type { WorkerApi } from '@/shared/types/apiContract.types'

/** Salud del Pool: colaboradores por estado, en el orden del semáforo. */
function poolByState(workers: WorkerApi[]): SnapshotItem[] {
  return WORKER_STATUSES.flatMap((code) => {
    const count = workers.filter((worker) => worker.state.code === code).length
    return count ? [{ key: code, label: WORKER_STATUS_LABEL[code], count }] : []
  })
}

export function WorkerTab({
  period,
  periodLabel,
}: {
  period: Period
  periodLabel: string
}): ReactNode {
  const [view, setView] = useState<DepartmentView>('kpis')
  const punches = useGetObserverPunchesSinceQuery(period.from.toISOString())
  const workers = useGetObserverWorkersQuery()
  /* Ingresos: todo el historial de semanas de timesheet; solo al abrir la vista. */
  const history = useGetObserverTimesheetHistoryQuery(undefined, { skip: view !== 'cohorts' })
  const requisitions = useGetObserverRequisitionsQuery(undefined, { skip: view !== 'cohorts' })

  const sources = view === 'kpis' ? [punches, workers] : [workers, history, requisitions]
  const error = sources.find((source) => source.error)?.error

  return (
    <div className="flex flex-col gap-4">
      <ViewSwitch value={view} onChange={setView} second="cohorts" />
      <TabState
        isLoading={sources.some((source) => source.isLoading)}
        error={error}
        onRetry={() => {
          for (const source of sources) if (source.error) void source.refetch()
        }}
        cards={view === 'kpis' ? 11 : 3}
      >
        {view === 'kpis'
          ? punches.data &&
            workers.data && (
              <>
                {(punches.data.truncated || workers.data.truncated) && <TruncatedNotice />}
                <SnapshotStrip items={poolByState(workers.data.rows)} />
                <KpiGrid
                  periodLabel={periodLabel}
                  kpis={workerKpis({
                    period,
                    punches: punches.data.rows,
                    workers: workers.data.rows,
                  })}
                />
              </>
            )
          : history.data &&
            workers.data &&
            requisitions.data && (
              <CohortsView
                timesheets={history.data.rows}
                truncated={history.data.truncated || workers.data.truncated}
                workers={workers.data.rows}
                requisitions={requisitions.data.rows}
              />
            )}
      </TabState>
    </div>
  )
}
