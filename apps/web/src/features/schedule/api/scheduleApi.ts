import type {
  ScheduleDemandRow,
  ScheduleTimeline,
  ScheduleWorkerEntry,
} from '../types/schedule.types'

import { registerScheduleMocks } from './scheduleMocks'

import { baseApi } from '@/app/baseApi'
/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import { addDaysIso } from '@/features/timesheet'
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

/**
 * La CINTA completa, como `fetchTimeline` del Timesheet: TODAS las semanas
 * del hotel de una vez —`/schedules` ya las trae todas— con las entradas de
 * CADA una, para que el arrastre continuo revele fechas vecinas sin volver a
 * pedir datos. La demanda no depende de qué semana esté a la vista.
 */
async function fetchTimeline(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: ScheduleTimeline } | { error: unknown }> {
  const [schedulesRes, requisitionsRes] = await Promise.all([
    fetchWithBQ('/schedules'),
    fetchWithBQ({ url: '/requisitions', params: { limit: 100 } }),
  ])
  if (schedulesRes.error) return { error: schedulesRes.error }
  if (requisitionsRes.error) return { error: requisitionsRes.error }

  const schedules = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const requisitions = (requisitionsRes.data as PaginatedEnvelope<RequisitionApi>).data

  /** Las semanas QUE EXISTEN, ascendentes: por ellas camina la cinta. */
  const availableWeeks = [...new Set(schedules.map((item) => item.weekStart))].sort()
  const days = availableWeeks.flatMap((weekStart) =>
    Array.from({ length: 7 }, (_item, index) => addDaysIso(weekStart, index)),
  )

  const entriesResults = await Promise.all(
    schedules.map((schedule) => fetchWithBQ(`/schedules/${schedule.id}/entries`)),
  )
  const entriesError = entriesResults.find((result) => result.error)
  if (entriesError) return { error: entriesError.error }

  const entries: ScheduleWorkerEntry[] = entriesResults
    .flatMap((result) => (result.data as ApiEnvelope<ScheduleEntryApi[]>).data)
    .map((entry) => ({
      id: entry.id,
      workDate: entry.workDate,
      workerId: entry.worker.id,
      workerName: entry.worker.fullName,
      startTime: timeOf(entry.startsAt),
      endTime: timeOf(entry.endsAt),
    }))

  /** La demanda es del hotel del schedule (todas las filas son el mismo hotel). */
  const hotelId = schedules[0]?.hotel.id ?? null
  const relevant = requisitions.filter(
    (requisition) =>
      DEMAND_STATES.has(requisition.state.code) &&
      (hotelId === null || requisition.hotel.id === hotelId),
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
      hotelName: schedules[0]?.hotel.name ?? relevant[0]?.hotel.name ?? '—',
      days,
      demand,
      entries,
      totalSlots: demand.reduce((sum, row) => sum + row.quantity, 0),
      filledSlots: demand.reduce((sum, row) => sum + row.filled, 0),
      availableWeeks,
    },
  }
}

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getScheduleTimeline: build.query<ScheduleTimeline, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchTimeline(fetchWithBQ as FetchWithBQ)
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

export const { useGetScheduleTimelineQuery } = scheduleApi
