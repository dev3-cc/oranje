import { Trans } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'

import {
  useGetObserverAssignmentsQuery,
  useGetObserverJournalsQuery,
  useGetObserverPunchesSinceQuery,
  useGetObserverRequisitionsQuery,
  useGetObserverWorkerHistoriesQuery,
  useGetObserverWorkersQuery,
  useGetStatusDurationsQuery,
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
import { journalCandidates, recruitmentPeople, signupCandidates } from '../lib/people'
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
  const [view, setView] = useState<DepartmentView>('kpis')
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

  /* La bitácora es una llamada por requisición: solo se pide al abrir «Por persona». */
  const journalIds = requisitions.data
    ? journalCandidates(requisitions.data.rows, period)
    : { ids: [], capped: false }
  const journals = useGetObserverJournalsQuery([...journalIds.ids].sort(), {
    skip: !requisitions.data || view !== 'people',
  })

  /* Quién dio de alta a cada candidato nuevo: su historial, también solo en «Por persona». */
  const signupIds = workers.data
    ? signupCandidates(workers.data.rows, period)
    : { ids: [], capped: false }
  const histories = useGetObserverWorkerHistoriesQuery([...signupIds.ids].sort(), {
    skip: !workers.data || view !== 'people',
  })

  const sources =
    view === 'people'
      ? [requisitions, workers, lights, journals, histories]
      : [requisitions, workers, lights]
  const error = sources.find((source) => source.error)?.error

  return (
    <div className="flex flex-col gap-4">
      <ViewSwitch value={view} onChange={setView} />
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
            {view === 'kpis' ? (
              <>
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
            ) : (
              journals.data &&
              histories.data && (
                <>
                  <PeopleNotice>
                    <Trans>
                      Sale de la bitácora de las requisiciones (quién las tomó, soltó o reasignó) y
                      del historial de cada candidato nuevo (quién lo dio de alta). A quién asignó
                      cada reclutador no se ve: eso se registra en otra bitácora que el Observador
                      no lee. Quien no movió ninguna requisición ni dio de alta a nadie no aparece.
                    </Trans>
                  </PeopleNotice>
                  {(journalIds.capped || signupIds.capped) && <TruncatedNotice />}
                  <PeopleView
                    columns={6}
                    periodLabel={periodLabel}
                    rows={recruitmentPeople({
                      period,
                      requisitions: requisitions.data.rows,
                      journals: journals.data,
                      workers: workers.data.rows,
                      histories: histories.data,
                    })}
                  />
                </>
              )
            )}
          </>
        )}
      </TabState>
    </div>
  )
}
