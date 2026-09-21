import type {
  DashboardRequisition,
  HotelOverview,
  RecruitmentOverview,
  StateCount,
} from '../types/dashboard.types'

import { baseApi } from '@/app/baseApi'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  RequisitionApi,
  TimesheetApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const QUEUE_OPEN = 'GREEN'
const QUEUE_IN_PROGRESS = 'YELLOW'
const DRAFT = 'APPLE_GREEN'
const FULLY_COVERED = 'LIGHT_BLUE'
const POOL_AVAILABLE = 'STRONG_GREEN'
const POOL_PENDING = 'WHITE'
const LIST_LIMIT = 6

function countStates(states: Array<{ code: string; name: string; color: string }>): StateCount[] {
  const buckets = new Map<string, StateCount>()
  for (const state of states) {
    const entry = buckets.get(state.code)
    if (entry) {
      entry.count += 1
    } else {
      buckets.set(state.code, { ...state, count: 1 })
    }
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count)
}

function toDashboardRequisition(row: RequisitionApi): DashboardRequisition {
  return {
    id: row.id,
    number: row.number,
    hotelName: row.hotel.name,
    hotelPhotoUrl: row.hotel.photoUrl ?? null,
    state: { code: row.state.code, name: row.state.name, color: row.state.color },
    totalSlots: row.totalSlots,
    filledSlots: row.filledSlots,
  }
}

async function fetchRecruitmentOverview(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: RecruitmentOverview } | { error: unknown }> {
  /* Los contadores se calculan sobre TODO el Pool y toda la cola, no sobre
     la primera página de 100: con 300 colaboradores «100 en el Pool» mentía. */
  const [workersRes, requisitionsRes] = await Promise.all([
    fetchAllPages<WorkerApi>(fetchWithBQ, '/workers'),
    fetchAllPages<RequisitionApi>(fetchWithBQ, '/requisitions'),
  ])
  if ('error' in workersRes) return { error: workersRes.error }
  if ('error' in requisitionsRes) return { error: requisitionsRes.error }

  const workers = workersRes.data
  const requisitions = requisitionsRes.data

  const queue = requisitions.filter(
    (row) => row.state.code === QUEUE_OPEN || row.state.code === QUEUE_IN_PROGRESS,
  )

  return {
    data: {
      poolTotal: workers.length,
      poolAvailable: workers.filter((worker) => worker.state.code === POOL_AVAILABLE).length,
      poolPendingValidation: workers.filter((worker) => worker.state.code === POOL_PENDING).length,
      poolByState: countStates(workers.map((worker) => worker.state)),
      queueOpen: queue.filter((row) => row.state.code === QUEUE_OPEN).length,
      queueInProgress: queue.filter((row) => row.state.code === QUEUE_IN_PROGRESS).length,
      queue: queue.slice(0, LIST_LIMIT).map(toDashboardRequisition),
    },
  }
}

async function fetchHotelOverview(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: HotelOverview } | { error: unknown }> {
  const [requisitionsRes, timesheetsRes] = await Promise.all([
    fetchAllPages<RequisitionApi>(fetchWithBQ, '/requisitions'),
    fetchWithBQ('/timesheets'),
  ])
  if ('error' in requisitionsRes) return { error: requisitionsRes.error }
  if (timesheetsRes.error) return { error: timesheetsRes.error }

  const requisitions = requisitionsRes.data
  const timesheets = (timesheetsRes.data as ApiEnvelope<TimesheetApi[]>).data

  return {
    data: {
      openRequisitions: requisitions.filter(
        (row) => row.state.code === QUEUE_OPEN || row.state.code === QUEUE_IN_PROGRESS,
      ).length,
      draftRequisitions: requisitions.filter((row) => row.state.code === DRAFT).length,
      coveredRequisitions: requisitions.filter((row) => row.state.code === FULLY_COVERED).length,
      pendingTimesheets: timesheets.filter((sheet) => sheet.approvedAt === null).length,
      requisitions: requisitions.slice(0, LIST_LIMIT).map(toDashboardRequisition),
    },
  }
}

export const roleDashboardsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRecruitmentOverview: build.query<RecruitmentOverview, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchRecruitmentOverview(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [
        { type: 'Worker', id: 'LIST' },
        { type: 'Requisition', id: 'LIST' },
      ],
    }),

    getHotelOverview: build.query<HotelOverview, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchHotelOverview(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [
        { type: 'Requisition', id: 'LIST' },
        { type: 'Timesheet', id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetRecruitmentOverviewQuery, useGetHotelOverviewQuery } = roleDashboardsApi
