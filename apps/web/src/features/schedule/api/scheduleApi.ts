import type { ScheduleDemandRow, ScheduleWeek, ScheduleWorkerEntry } from '../types/schedule.types'

import { registerScheduleMocks } from './scheduleMocks'

import { baseApi } from '@/app/baseApi'
/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import { addDaysIso, resolveWeek } from '@/features/timesheet'
import type {
  ApiEnvelope,
  PaginatedEnvelope,
  RequisitionApi,
  ScheduleApi,
  ScheduleEntryApi,
} from '@/shared/types/apiContract.types'

/**
 * El Schedule semanal del hotel COMPONE tres recursos reales: `/schedules`
 * (TODAS las semanas del hotel), sus entradas (quién está programado cada
 * día) y `/requisitions` (la demanda por posición). La cobertura por posición
 * viene de la requisición; el desglose por DÍA necesita que el contrato ligue
 * `schedule_entry` con la posición — hasta entonces, el resumen de cobertura
 * enseña la cobertura real de la posición, no una inventada por día.
 */
registerScheduleMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Estados con demanda viva: autorizada en adelante, sin las terminales. */
const DEMAND_STATES = new Set(['GREEN', 'YELLOW', 'RED'])

function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

async function fetchWeek(
  fetchWithBQ: FetchWithBQ,
  requestedWeekStart: string,
): Promise<{ data: ScheduleWeek } | { error: unknown }> {
  const [schedulesRes, requisitionsRes] = await Promise.all([
    fetchWithBQ('/schedules'),
    fetchWithBQ({ url: '/requisitions', params: { limit: 100 } }),
  ])
  if (schedulesRes.error) return { error: schedulesRes.error }
  if (requisitionsRes.error) return { error: requisitionsRes.error }

  const schedules = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const requisitions = (requisitionsRes.data as PaginatedEnvelope<RequisitionApi>).data

  /** Las semanas QUE EXISTEN; se enseña la pedida o, sin ella, la más reciente. */
  const availableWeeks = [...new Set(schedules.map((item) => item.weekStart))].sort()
  const weekStart = resolveWeek(availableWeeks, requestedWeekStart)
  const schedule = weekStart
    ? (schedules.find((item) => item.weekStart === weekStart) ?? null)
    : null

  let entries: ScheduleWorkerEntry[] = []
  let days: string[] = []
  if (schedule) {
    days = Array.from({ length: 7 }, (_item, index) => addDaysIso(schedule.weekStart, index))
    const entriesRes = await fetchWithBQ(`/schedules/${schedule.id}/entries`)
    if (!entriesRes.error) {
      entries = (entriesRes.data as ApiEnvelope<ScheduleEntryApi[]>).data.map((entry) => ({
        id: entry.id,
        workDate: entry.workDate,
        workerId: entry.worker.id,
        workerName: entry.worker.fullName,
        startTime: timeOf(entry.startsAt),
        endTime: timeOf(entry.endsAt),
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
      weekStart: weekStart ?? '',
      availableWeeks,
    },
  }
}

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getScheduleWeek: build.query<ScheduleWeek, { weekStart: string }>({
      queryFn: async (arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchWeek(fetchWithBQ as FetchWithBQ, arg.weekStart)
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
