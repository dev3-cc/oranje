import type { ReactNode } from 'react'

import {
  useGetObserverAssignmentsQuery,
  useGetObserverPunchesSinceQuery,
  useGetObserverRequisitionsQuery,
  useGetObserverWorkersQuery,
  useGetStatusDurationsQuery,
} from '../api/observabilityApi'
import { KpiGrid } from '../components/KpiCard'
import { type SnapshotItem, SnapshotStrip, TabState, TruncatedNotice } from '../components/TabParts'
import { type Period } from '../lib/period'
import { dayOneCandidates, dayOneNoShow, recruitmentKpis } from '../lib/recruitmentKpis'

import {
  URGENCY_LABEL,
  URGENCY_LEVELS,
  type UrgencyLevel,
} from '@/shared/constants/requisitionStatus'
import type { RequisitionApi } from '@/shared/types/apiContract.types'

/** Lugares sin cubrir por urgencia, en las requisiciones que se están llenando. */
function openSlotsByUrgency(requisitions: RequisitionApi[]): SnapshotItem[] {
  const counts = new Map<UrgencyLevel, number>()
  for (const requisition of requisitions) {
    if (requisition.state.code !== 'GREEN' && requisition.state.code !== 'YELLOW') continue
    for (const position of requisition.positions) {
      const urgency = position.urgency?.code as UrgencyLevel | undefined
      const open = position.quantity - position.filled
      if (!urgency || open <= 0) continue
      counts.set(urgency, (counts.get(urgency) ?? 0) + open)
    }
  }
  return URGENCY_LEVELS.flatMap((level) => {
    const count = counts.get(level)
    return count ? [{ key: level, label: URGENCY_LABEL[level], count }] : []
  })
}

export function RecruitmentTab({
  period,
  periodLabel,
}: {
  period: Period
  periodLabel: string
}): ReactNode {
  const requisitions = useGetObserverRequisitionsQuery()
  const workers = useGetObserverWorkersQuery()
  const lights = useGetStatusDurationsQuery()
  const punches = useGetObserverPunchesSinceQuery(period.from.toISOString())

  const candidates = requisitions.data ? dayOneCandidates(requisitions.data.rows, period) : []
  const assignments = useGetObserverAssignmentsQuery(
    candidates.map((requisition) => requisition.id).sort(),
    { skip: !requisitions.data },
  )

  const dayOne =
    assignments.data && punches.data
      ? dayOneNoShow(
          candidates.map((requisition) => ({
            requisition,
            assignments: assignments.data?.[requisition.id] ?? [],
          })),
          punches.data.rows,
          period,
        )
      : null

  const sources = [requisitions, workers, lights]
  const error = sources.find((source) => source.error)?.error

  return (
    <TabState
      isLoading={sources.some((source) => source.isLoading)}
      error={error}
      onRetry={() => {
        for (const source of sources) if (source.error) void source.refetch()
      }}
      cards={5}
    >
      {requisitions.data && workers.data && (
        <>
          {(requisitions.data.truncated || workers.data.truncated || punches.data?.truncated) && (
            <TruncatedNotice />
          )}
          <SnapshotStrip items={openSlotsByUrgency(requisitions.data.rows)} />
          <KpiGrid
            periodLabel={periodLabel}
            kpis={recruitmentKpis({
              period,
              requisitions: requisitions.data.rows,
              workers: workers.data.rows,
              requisitionLight: lights.data?.find((light) => light.code === 'REQUISITION'),
              dayOne,
            })}
          />
        </>
      )}
    </TabState>
  )
}
