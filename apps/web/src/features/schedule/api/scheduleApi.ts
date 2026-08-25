import type { ScheduleDemandRow, ScheduleWeek, ScheduleWorkerEntry } from '../types/schedule.types'

import { registerScheduleMocks } from './scheduleMocks'

import { baseApi } from '@/app/baseApi'
import type {
  ApiEnvelope,
  PaginatedEnvelope,
  RequisitionApi,
  ScheduleApi,
  ScheduleEntryApi,
} from '@/shared/types/apiContract.types'

/**
 * El Schedule semanal del hotel COMPONE tres recursos reales: `/schedules`
 * (la semana del hotel), sus entradas (quién está programado cada día) y
 * `/requisitions` (la demanda por posición). La cobertura por posición viene
 * de la requisición; el desglose por DÍA necesita que el contrato ligue
 * `schedule_entry` con la posición — hasta entonces, cada celda enseña la
 * cobertura real de la posición, no una inventada por día.
 */
registerScheduleMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000

/** Estados con demanda viva: autorizada en adelante, sin las terminales. */
const DEMAND_STATES = new Set(['GREEN', 'YELLOW', 'RED'])

function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

async function fetchWeek(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: ScheduleWeek } | { error: unknown }> {
  const [schedulesRes, requisitionsRes] = await Promise.all([
    fetchWithBQ('/schedules'),
    fetchWithBQ({ url: '/requisitions', params: { limit: 100 } }),
  ])
  if (schedulesRes.error) return { error: schedulesRes.error }
  if (requisitionsRes.error) return { error: requisitionsRes.error }

  const schedules = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const requisitions = (requisitionsRes.data as PaginatedEnvelope<RequisitionApi>).data

  /** La semana visible: la más reciente del hotel de quien pregunta. */
  const schedule = [...schedules].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]

  let entries: ScheduleWorkerEntry[] = []
  let days: string[] = []
  if (schedule) {
    days = Array.from({ length: 7 }, (_item, index) =>
      new Date(new Date(schedule.weekStart).getTime() + index * MS_PER_DAY)
        .toISOString()
        .slice(0, 10),
    )
    const entriesRes = await fetchWithBQ(`/schedules/${schedule.id}/entries`)
    if (!entriesRes.error) {
      entries = (entriesRes.data as ApiEnvelope<ScheduleEntryApi[]>).data.map((entry) => ({
        id: entry.id,
        workDate: entry.workDate,
        workerName: entry.worker.fullName,
        shift: `${timeOf(entry.startsAt)} – ${timeOf(entry.endsAt)}`,
      }))
    }
  }

  /** La demanda del hotel del schedule; sin schedule, la de todo el alcance. */
  const relevant = requisitions.filter(
    (requisition) =>
      DEMAND_STATES.has(requisition.state.code) &&
      (!schedule || requisition.hotel.id === schedule.hotel.id),
  )

  const demand: ScheduleDemandRow[] = relevant.flatMap((requisition) =>
    requisition.positions.map((position) => ({
      positionId: position.id,
      name: position.position.name,
      startTime: position.startTime ?? '—',
      quantity: position.quantity,
      filled: position.filled,
      lineNumber: position.lineNumber,
      requisitionNumber: requisition.number,
    })),
  )

  return {
    data: {
      hotelName: schedule?.hotel.name ?? relevant[0]?.hotel.name ?? '—',
      days,
      demand,
      entries,
      totalSlots: demand.reduce((sum, row) => sum + row.quantity, 0),
      filledSlots: demand.reduce((sum, row) => sum + row.filled, 0),
    },
  }
}

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getScheduleWeek: build.query<ScheduleWeek, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchWeek(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      /** Asignar un slot o autorizar demanda mueve esta vista. */
      providesTags: [
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Timesheet' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetScheduleWeekQuery } = scheduleApi
