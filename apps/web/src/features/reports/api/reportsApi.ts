import type {
  AttemptsMatrix,
  ConversionByBd,
  ExitReason,
  SalesReport,
  TimeInState,
} from '../types/reports.types'

import { registerReportsMocks } from './reportsMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type {
  ApiEnvelope,
  ContactAttemptApi,
  HistoryEntryApi,
  PaginatedEnvelope,
  ProspectApi,
  TeamMemberApi,
} from '@/shared/types/apiContract.types'

/**
 * Reportes · Ventas se COMPONE del contrato real: `/team`, `/prospects` con
 * cerrados, y el historial e intentos de cada prospecto (en paralelo, D-28).
 * Es la composición más pesada del sistema — cuando duela, este es el primer
 * candidato a endpoint agregador del backend, con esta MISMA forma.
 */
registerReportsMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000
const BRANCHES: OnboardingStatus[] = ['RED', 'BROWN', 'BLACK']
const MAIN_PATH: OnboardingStatus[] = ['GRAY', 'LIGHT_BLUE', 'GREEN', 'YELLOW', 'PINK']

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS_PER_DAY)
}

function buildConversionByBd(members: TeamMemberApi[], prospects: ProspectApi[]): ConversionByBd[] {
  return members.map((member) => {
    const own = prospects.filter((prospect) => prospect.owner.id === member.id)
    const open = own.filter((prospect) => prospect.isOpen && prospect.state.code !== 'ORANGE')
    const converted = own.filter((prospect) => prospect.state.code === 'ORANGE')
    const days = converted.map((prospect) =>
      Math.round(daysBetween(prospect.openedAt, prospect.stateSince)),
    )
    return {
      id: member.id,
      fullName: member.fullName,
      open: open.length,
      converted: converted.length,
      rate:
        open.length + converted.length === 0
          ? 0
          : converted.length / (open.length + converted.length),
      averageDays: days.length
        ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)
        : null,
    }
  })
}

/** Promedio de días en cada estado, medido entre transiciones del historial. */
function buildTimeInState(histories: HistoryEntryApi[][]): TimeInState[] {
  const totals = new Map<string, { days: number; count: number }>()

  for (const history of histories) {
    /** El historial llega del más nuevo al más viejo: se recorre al revés. */
    const ordered = [...history].reverse()
    for (const [index, entry] of ordered.entries()) {
      const next = ordered[index + 1]
      if (!next) continue
      const state = entry.toState.code
      const stay = daysBetween(entry.occurredAt, next.occurredAt)
      const bucket = totals.get(state) ?? { days: 0, count: 0 }
      bucket.days += stay
      bucket.count += 1
      totals.set(state, bucket)
    }
  }

  return MAIN_PATH.map((status) => {
    const bucket = totals.get(status)
    return {
      status,
      averageDays: bucket && bucket.count > 0 ? Math.round(bucket.days / bucket.count) : null,
    }
  })
}

function buildAttempts(attempts: ContactAttemptApi[]): AttemptsMatrix {
  const channels = [...new Set(attempts.map((attempt) => attempt.attemptType))].sort()
  const outcomes = [...new Set(attempts.map((attempt) => attempt.outcome))].sort()
  return {
    channels,
    rows: outcomes.map((outcome) => ({
      outcome,
      counts: channels.map(
        (channel) =>
          attempts.filter(
            (attempt) => attempt.attemptType === channel && attempt.outcome === outcome,
          ).length,
      ),
    })),
  }
}

function buildExits(histories: HistoryEntryApi[][]): {
  exits: SalesReport['exits']
  exitReasons: ExitReason[]
} {
  const toBranch = histories
    .flat()
    .filter((entry) => BRANCHES.includes(entry.toState.code as OnboardingStatus))

  const reasonCount = new Map<string, number>()
  for (const entry of toBranch) {
    const label = entry.reason?.name ?? 'Sin motivo registrado'
    reasonCount.set(label, (reasonCount.get(label) ?? 0) + 1)
  }

  return {
    exits: {
      total: toBranch.length,
      red: toBranch.filter((entry) => entry.toState.code === 'RED').length,
      brown: toBranch.filter((entry) => entry.toState.code === 'BROWN').length,
      black: toBranch.filter((entry) => entry.toState.code === 'BLACK').length,
    },
    exitReasons: [...reasonCount.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  }
}

async function fetchReport(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: SalesReport } | { error: unknown }> {
  const [teamRes, prospectsRes] = await Promise.all([
    fetchWithBQ('/team'),
    fetchWithBQ({ url: '/prospects', params: { limit: 100, includeClosed: true } }),
  ])
  if (teamRes.error) return { error: teamRes.error }
  if (prospectsRes.error) return { error: prospectsRes.error }

  const members = (teamRes.data as ApiEnvelope<TeamMemberApi[]>).data
  const prospects = (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data

  /** Historial e intentos de cada ciclo, en paralelo. */
  const [historiesRes, attemptsRes] = await Promise.all([
    Promise.all(prospects.map((prospect) => fetchWithBQ(`/prospects/${prospect.id}/history`))),
    Promise.all(
      prospects.map((prospect) => fetchWithBQ(`/prospects/${prospect.id}/contact-attempts`)),
    ),
  ])

  const histories = historiesRes
    .filter((res) => !res.error)
    .map((res) => (res.data as ApiEnvelope<HistoryEntryApi[]>).data)
  const attempts = attemptsRes
    .filter((res) => !res.error)
    .flatMap((res) => (res.data as ApiEnvelope<ContactAttemptApi[]>).data)

  const conversionByBd = buildConversionByBd(members, prospects)
  const timeInState = buildTimeInState(histories)
  const withData = timeInState.filter((item) => item.averageDays !== null)
  const bottleneck =
    withData.length > 0
      ? withData.reduce((worst, item) =>
          (item.averageDays ?? 0) > (worst.averageDays ?? 0) ? item : worst,
        )
      : null

  const open = conversionByBd.reduce((sum, row) => sum + row.open, 0)
  const converted = conversionByBd.reduce((sum, row) => sum + row.converted, 0)
  const allDays = conversionByBd
    .map((row) => row.averageDays)
    .filter((days): days is number => days !== null)

  return {
    data: {
      conversionByBd,
      teamTotals: {
        open,
        converted,
        rate: open + converted === 0 ? 0 : converted / (open + converted),
        averageDays: allDays.length
          ? Math.round(allDays.reduce((sum, days) => sum + days, 0) / allDays.length)
          : null,
      },
      timeInState,
      bottleneck,
      attempts: buildAttempts(attempts),
      ...buildExits(histories),
    },
  }
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSalesReport: build.query<SalesReport, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchReport(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Prospect' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetSalesReportQuery } = reportsApi
