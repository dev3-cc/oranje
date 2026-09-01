import type { PersonnelBoard, PersonnelRow } from '../types/personnel.types'

import { baseApi } from '@/app/baseApi'
/*
 * ⚠ Imports entre features, permitidos SOLO para registrar mocks: el turno lo
 * sirve Schedule, las marcas Timesheet y el semáforo el Pool. Apagados, no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerPoolMocks } from '@/features/recruitment/api/poolMocks'
// eslint-disable-next-line no-restricted-imports
import { registerScheduleMocks } from '@/features/schedule/api/scheduleMocks'
// eslint-disable-next-line no-restricted-imports
import { registerTimesheetMocks } from '@/features/timesheet/api/timesheetMocks'
import type {
  ApiEnvelope,
  PaginatedEnvelope,
  ScheduleApi,
  ScheduleEntryApi,
  TimesheetApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/**
 * Mi Personal COMPONE el contrato real (D-28): `GET /schedules` +
 * `/schedules/:id/entries` para el turno, `GET /timesheets` para las marcas y
 * `GET /workers` para el semáforo. Stand-by es la MISMA transición del
 * semáforo (`POST /workers/:id/transitions` → PINK), no un endpoint aparte.
 */
registerScheduleMocks()
registerTimesheetMocks()
registerPoolMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Solo desde un estado operativo se manda a descansar (seed del semáforo). */
const OPERATIONAL_STATES = new Set(['APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE', 'BROWN'])

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchBoard(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: PersonnelBoard } | { error: unknown }> {
  const [schedulesRes, timesheetsRes, workersRes] = await Promise.all([
    fetchWithBQ('/schedules'),
    fetchWithBQ('/timesheets'),
    fetchWithBQ({ url: '/workers', params: { limit: 100 } }),
  ])
  for (const res of [schedulesRes, timesheetsRes, workersRes]) {
    if (res.error) return { error: res.error }
  }

  const [schedule] = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const workers = (workersRes.data as PaginatedEnvelope<WorkerApi>).data
  const timesheetList = (timesheetsRes.data as ApiEnvelope<TimesheetApi[]>).data

  /** La lista viaja SIN días (como el backend): las marcas van por detalle. */
  const detailResults = await Promise.all(
    timesheetList.map((timesheet) => fetchWithBQ(`/timesheets/${timesheet.id}`)),
  )
  const timesheets = detailResults
    .filter((res) => !res.error)
    .map((res) => (res.data as ApiEnvelope<TimesheetApi>).data)

  let entries: ScheduleEntryApi[] = []
  if (schedule) {
    const entriesRes = await fetchWithBQ(`/schedules/${schedule.id}/entries`)
    if (entriesRes.error) return { error: entriesRes.error }
    entries = (entriesRes.data as ApiEnvelope<ScheduleEntryApi[]>).data
  }

  const today = todayIso()
  const workerById = new Map(workers.map((worker) => [worker.id, worker]))

  /** El turno de HOY por persona (el primero, si tuviera dos). */
  const shiftByWorker = new Map<string, ScheduleEntryApi>()
  for (const entry of entries) {
    if (entry.workDate === today && !shiftByWorker.has(entry.worker.id)) {
      shiftByWorker.set(entry.worker.id, entry)
    }
  }

  /** La entrada de hoy: la primera marca CLOCK_IN del día del timesheet. */
  const clockInByWorker = new Map<string, string>()
  for (const timesheet of timesheets) {
    const day = timesheet.days?.find((item) => item.workDate === today)
    const clockIn = day?.punches.find((punch) => punch.type === 'CLOCK_IN')
    if (clockIn) clockInByWorker.set(timesheet.worker.id, clockIn.serverAt)
  }

  /**
   * El plantel: quien tiene turno esta semana, MÁS quien está en Stand-by o
   * accidentado — el GRIS protege y se ve aunque hoy no esté programado.
   */
  const rosterIds = new Set<string>(entries.map((entry) => entry.worker.id))
  for (const worker of workers) {
    if (worker.state.code === 'PINK' || worker.state.code === 'GRAY') rosterIds.add(worker.id)
  }

  const rows: PersonnelRow[] = [...rosterIds]
    .map((workerId): PersonnelRow | null => {
      const worker = workerById.get(workerId)
      if (!worker) return null
      const shift = shiftByWorker.get(workerId)
      return {
        workerId,
        fullName: worker.fullName,
        photoUrl: worker.photoUrl,
        phone: worker.phone,
        positionName: worker.position?.name ?? '—',
        stateCode: worker.state.code,
        shift: shift ? { startsAt: shift.startsAt, endsAt: shift.endsAt } : null,
        clockInAt: clockInByWorker.get(workerId) ?? null,
        canStandBy: OPERATIONAL_STATES.has(worker.state.code),
      }
    })
    .filter((row): row is PersonnelRow => row !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return {
    data: {
      rows,
      assignedToday: rows.filter((row) => row.shift !== null).length,
      clockedInToday: rows.filter((row) => row.clockInAt !== null).length,
      inStandBy: rows.filter((row) => row.stateCode === 'PINK').length,
      inAccident: rows.filter((row) => row.stateCode === 'GRAY').length,
    },
  }
}

export const personnelApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPersonnelBoard: build.query<PersonnelBoard, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchBoard(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [
        { type: 'Worker' as const, id: 'LIST' },
        { type: 'Schedule' as const, id: 'LIST' },
      ],
    }),

    /** Stand-by (Rosa): la transición del semáforo, con motivo del catálogo (encargo 12) y nota opcional. */
    sendToStandBy: build.mutation<unknown, { workerId: string; reasonCode: string; note?: string }>(
      {
        query: ({ workerId, reasonCode, note }) => ({
          url: `/workers/${workerId}/transitions`,
          method: 'POST',
          body: { toState: 'PINK', reasonCode, ...(note ? { note } : {}) },
        }),
        invalidatesTags: [{ type: 'Worker' as const, id: 'LIST' }],
      },
    ),
  }),
})

export const { useGetPersonnelBoardQuery, useSendToStandByMutation } = personnelApi
