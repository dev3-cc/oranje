import type { ReactNode } from 'react'

import {
  useGetObserverPendingWeeksQuery,
  useGetObserverRequisitionsQuery,
  useGetStatusDurationsQuery,
} from '../api/observabilityApi'
import { KpiGrid } from '../components/KpiCard'
import { type SnapshotItem, SnapshotStrip, TabState, TruncatedNotice } from '../components/TabParts'
import { hotelKpis } from '../lib/hotelKpis'
import { type Period } from '../lib/period'

import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUSES,
} from '@/shared/constants/requisitionStatus'
import type { RequisitionApi } from '@/shared/types/apiContract.types'

/** Requisiciones por estado, en el orden del semáforo; las eliminadas no. */
export function requisitionsByState(requisitions: RequisitionApi[]): SnapshotItem[] {
  return REQUISITION_STATUSES.filter((code) => code !== 'PURPLE').flatMap((code) => {
    const count = requisitions.filter((requisition) => requisition.state.code === code).length
    return count ? [{ key: code, label: REQUISITION_STATUS_LABEL[code], count }] : []
  })
}

export function HotelTab({
  period,
  periodLabel,
}: {
  period: Period
  periodLabel: string
}): ReactNode {
  const requisitions = useGetObserverRequisitionsQuery()
  const pendingWeeks = useGetObserverPendingWeeksQuery()
  const lights = useGetStatusDurationsQuery()

  const sources = [requisitions, pendingWeeks, lights]
  const error = sources.find((source) => source.error)?.error

  return (
    <TabState
      isLoading={sources.some((source) => source.isLoading)}
      error={error}
      onRetry={() => {
        for (const source of sources) if (source.error) void source.refetch()
      }}
      cards={6}
    >
      {requisitions.data && pendingWeeks.data !== undefined && (
        <>
          {requisitions.data.truncated && <TruncatedNotice />}
          <SnapshotStrip items={requisitionsByState(requisitions.data.rows)} />
          <KpiGrid
            periodLabel={periodLabel}
            kpis={hotelKpis({
              period,
              requisitions: requisitions.data.rows,
              pendingWeeks: pendingWeeks.data,
              weekApproval: lights.data?.find((light) => light.code === 'WEEK_APPROVAL'),
              worker: lights.data?.find((light) => light.code === 'WORKER'),
            })}
          />
        </>
      )}
    </TabState>
  )
}
