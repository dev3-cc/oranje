import type {
  CreateShiftRequest,
  ScheduleAssignee,
  ScheduleDemandRow,
  ScheduleTimeline,
  ScheduleWorkerEntry,
} from '../types/schedule.types'

import { registerScheduleMocks } from './scheduleMocks'

import { baseApi } from '@/app/baseApi'
/** Piezas genéricas de navegación semanal, expuestas por el índice de Timesheet (§4). */
import { addDaysIso } from '@/features/timesheet'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  AssignmentApi,
  MeApi,
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
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Estados con demanda viva: autorizada en adelante, sin las terminales. */
const DEMAND_STATES = new Set(['GREEN', 'YELLOW', 'RED'])

const MS_PER_DAY = 86_400_000

function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

/** El lunes de la semana que contiene `iso` (aritmética en UTC, como `days`). */
function mondayOf(iso: string): string {
  const weekday = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - weekday * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
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
  const [meRes, schedulesRes, requisitionsRes] = await Promise.all([
    fetchWithBQ('/me'),
    fetchWithBQ('/schedules'),
    /* Antes `limit: 100` y nada más: un hotel con más de 100 requisiciones en
       demanda viva perdía las de más allá, y `totalSlots`/`filledSlots`
       mentían en silencio — el mismo patrón que ya se corrigió en 8 pantallas. */
    fetchAllPages<RequisitionApi>(fetchWithBQ, '/requisitions'),
  ])
  if (meRes.error) return { error: meRes.error }
  if (schedulesRes.error) return { error: schedulesRes.error }
  if ('error' in requisitionsRes) return { error: requisitionsRes.error }

  const me = (meRes.data as ApiEnvelope<MeApi>).data
  const schedules = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const requisitions = requisitionsRes.data

  /* El hotel viene de `/me`, no del primer schedule: un hotel SIN ningún
     schedule todavía (nunca se programó una semana) se quedaba sin filtro y
     mezclaba la demanda de TODOS los hoteles — hallazgo al construir «Agregar
     turno», que necesita el hotelId siempre, exista o no un schedule. */
  const hotelId = me.hotel?.id ?? null

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

  /* «Agregar turno» necesita a QUIÉN — alguien con asignación ACTIVA en una
     de estas requisiciones. Sin posición (comentario en `ScheduleAssignee`):
     no se inventa el vínculo asignación↔posición que el contrato no da. */
  const assignmentsResults = await Promise.all(
    relevant.map((requisition) => fetchWithBQ(`/requisitions/${requisition.id}/assignments`)),
  )
  const assignmentsError = assignmentsResults.find((result) => result.error)
  if (assignmentsError) return { error: assignmentsError.error }

  const assignees: ScheduleAssignee[] = assignmentsResults
    .flatMap((result) => (result.data as ApiEnvelope<AssignmentApi[]>).data)
    .filter((assignment) => assignment.status === 'ACTIVE')
    .map((assignment) => ({
      assignmentId: assignment.id,
      workerId: assignment.worker.id,
      workerName: assignment.worker.fullName,
    }))

  return {
    data: {
      hotelId: hotelId ?? '',
      hotelName: me.hotel?.name ?? schedules[0]?.hotel.name ?? relevant[0]?.hotel.name ?? '—',
      days,
      demand,
      entries,
      totalSlots: demand.reduce((sum, row) => sum + row.quantity, 0),
      filledSlots: demand.reduce((sum, row) => sum + row.filled, 0),
      availableWeeks,
      assignees,
    },
  }
}

/**
 * Crea el turno de un día: si la semana todavía no tiene `schedule` (nunca se
 * programó), lo crea primero — antes esto solo se podía hacer por API/Postman,
 * sin un solo botón en el front.
 */
async function createShift(
  fetchWithBQ: FetchWithBQ,
  dto: CreateShiftRequest,
): Promise<{ data: undefined } | { error: unknown }> {
  const weekStart = mondayOf(dto.workDate)

  const schedulesRes = await fetchWithBQ('/schedules')
  if (schedulesRes.error) return { error: schedulesRes.error }
  const schedules = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const existing = schedules.find(
    (schedule) => schedule.hotel.id === dto.hotelId && schedule.weekStart === weekStart,
  )

  let scheduleId = existing?.id ?? null
  if (scheduleId === null) {
    const createRes = await fetchWithBQ({
      url: '/schedules',
      method: 'POST',
      body: { hotelId: dto.hotelId, weekStart },
    })
    if (createRes.error) return { error: createRes.error }
    scheduleId = (createRes.data as ApiEnvelope<ScheduleApi>).data.id
  }

  const entryRes = await fetchWithBQ({
    url: `/schedules/${scheduleId}/entries`,
    method: 'POST',
    body: {
      assignmentId: dto.assignmentId,
      workDate: dto.workDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
    },
  })
  if (entryRes.error) return { error: entryRes.error }

  return { data: undefined }
}

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getScheduleTimeline: build.query<ScheduleTimeline, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchTimeline(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      /** Asignar un slot, autorizar demanda o agregar un turno mueve esta vista. */
      providesTags: [
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Timesheet' as const, id: 'LIST' },
        { type: 'Schedule' as const, id: 'LIST' },
      ],
    }),

    /** «Agregar turno» (Manager de Área o General, `schedule:update`). */
    createShift: build.mutation<undefined, CreateShiftRequest>({
      queryFn: async (dto, _api, _extra, fetchWithBQ) => {
        const result = await createShift(fetchWithBQ as FetchWithBQ, dto)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      invalidatesTags: [{ type: 'Schedule' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetScheduleTimelineQuery, useCreateShiftMutation } = scheduleApi
