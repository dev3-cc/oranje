import type { ReactNode } from 'react'

import {
  useGetObserverPunchesSinceQuery,
  useGetObserverWorkersQuery,
} from '../api/observabilityApi'
import { KpiGrid } from '../components/KpiCard'
import { type SnapshotItem, SnapshotStrip, TabState, TruncatedNotice } from '../components/TabParts'
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
  const punches = useGetObserverPunchesSinceQuery(period.from.toISOString())
  const workers = useGetObserverWorkersQuery()

  const sources = [punches, workers]
  const error = sources.find((source) => source.error)?.error

  return (
    <TabState
      isLoading={sources.some((source) => source.isLoading)}
      error={error}
      onRetry={() => {
        for (const source of sources) if (source.error) void source.refetch()
      }}
      cards={11}
    >
      {punches.data && workers.data && (
        <>
          {(punches.data.truncated || workers.data.truncated) && <TruncatedNotice />}
          <SnapshotStrip items={poolByState(workers.data.rows)} />
          <KpiGrid
            periodLabel={periodLabel}
            kpis={workerKpis({ period, punches: punches.data.rows, workers: workers.data.rows })}
          />
        </>
      )}
    </TabState>
  )
}
