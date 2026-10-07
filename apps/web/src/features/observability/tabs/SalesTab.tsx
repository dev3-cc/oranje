import type { ReactNode } from 'react'

import {
  useGetObserverClientHotelsQuery,
  useGetObserverContactAttemptsQuery,
  useGetObserverProspectsQuery,
  useGetObserverRequisitionsQuery,
  useGetStatusDurationsQuery,
} from '../api/observabilityApi'
import { KpiGrid } from '../components/KpiCard'
import { type SnapshotItem, SnapshotStrip, TabState, TruncatedNotice } from '../components/TabParts'
import { type Period } from '../lib/period'
import { salesKpis } from '../lib/salesKpis'

import { ONBOARDING_STATUS_LABEL, type OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type { ProspectApi } from '@/shared/types/apiContract.types'

/** Prospectos abiertos por estado del Semáforo Onboarding. */
function openByState(prospects: ProspectApi[]): SnapshotItem[] {
  const counts = new Map<string, number>()
  for (const prospect of prospects) {
    if (!prospect.isOpen) continue
    counts.set(prospect.state.code, (counts.get(prospect.state.code) ?? 0) + 1)
  }
  return [...counts].map(([code, count]) => ({
    key: code,
    label: ONBOARDING_STATUS_LABEL[code as OnboardingStatus] ?? code,
    count,
  }))
}

export function SalesTab({
  period,
  periodLabel,
}: {
  period: Period
  periodLabel: string
}): ReactNode {
  const prospects = useGetObserverProspectsQuery()
  const hotels = useGetObserverClientHotelsQuery()
  const requisitions = useGetObserverRequisitionsQuery()
  const lights = useGetStatusDurationsQuery()

  /* Solo los prospectos con un intento desde el inicio del periodo pueden
     tener intentos en él: el resto no se pide (una llamada por prospecto). */
  const from = period.from.getTime()
  const movedIds = (prospects.data?.rows ?? [])
    .filter(
      (prospect) =>
        prospect.lastAttempt && new Date(prospect.lastAttempt.occurredAt).getTime() >= from,
    )
    .map((prospect) => prospect.id)
    .sort()
  const attempts = useGetObserverContactAttemptsQuery(movedIds, { skip: !prospects.data })

  const sources = [prospects, hotels, requisitions, lights, attempts]
  const error = sources.find((source) => source.error)?.error

  return (
    <TabState
      isLoading={sources.some((source) => source.isLoading)}
      error={error}
      onRetry={() => {
        for (const source of sources) if (source.error) void source.refetch()
      }}
      cards={7}
    >
      {prospects.data && hotels.data && requisitions.data && (
        <>
          {(prospects.data.truncated || hotels.data.truncated || requisitions.data.truncated) && (
            <TruncatedNotice />
          )}
          <SnapshotStrip items={openByState(prospects.data.rows)} />
          <KpiGrid
            periodLabel={periodLabel}
            kpis={salesKpis({
              period,
              prospects: prospects.data.rows,
              attempts: attempts.data ?? [],
              clientHotels: hotels.data.rows,
              requisitions: requisitions.data.rows,
              onboarding: lights.data?.find((light) => light.code === 'ONBOARDING'),
            })}
          />
        </>
      )}
    </TabState>
  )
}
