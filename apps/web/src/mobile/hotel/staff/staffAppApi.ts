import { baseApi } from '@/app/baseApi'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  ScheduleApi,
  ScheduleEntryApi,
  TimesheetApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/**
 * Mi personal en la app: los MISMOS datos que compone el web
 * (`features/personnel/api/personnelApi.ts`) —el Schedule de la semana, los
 * timesheets, el semáforo de cada colaborador— sobre los mismos endpoints. El
 * API recorta por alcance con la sesión.
 *
 * La plantilla es quien tiene turno esta semana, MÁS quien está en Stand-by
 * (Rosa) o accidentado (Gris): esos se ven aunque hoy no estén programados.
 */

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Solo desde un estado operativo se manda a Stand-by o se reporta (seed del semáforo). */
const OPERATIONAL_STATES: ReadonlySet<string> = new Set([
  'APPLE_GREEN',
  'LIGHT_BLUE',
  'ORANGE',
  'BROWN',
])

/** Tolerancia de puntualidad, la misma del web: hasta 10 minutos tarde. */
const ON_TIME_MINUTES = 10

export interface StaffMember {
  workerId: string
  fullName: string
  photoUrl: string | null
  phone: string
  positionName: string | null
  stateCode: string
  /** Turno de HOY; `null` = descansa hoy. */
  shift: { startsAt: string; endsAt: string } | null
  /** La primera entrada de hoy; `null` = no ha marcado. */
  clockInAt: string | null
  /** La zona del hotel: las horas se leen donde ocurren. */
  timeZone: string | undefined
  isOperational: boolean
  /** Asistencia y puntualidad de la semana, 0–100; `null` sin días comparables. */
  attendance: number | null
  punctuality: number | null
  emergencyContact: { name: string; phone: string; relationship: string } | null
  englishLevel: string | null
  hiringModality: string | null
}

export interface StaffBoard {
  members: StaffMember[]
  withShiftToday: number
  clockedInToday: number
  inStandBy: number
  inAccident: number
}

export type StaffTransition = 'PINK' | 'RED'

function ratio(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 100)
}

async function fetchBoard(bq: FetchWithBQ): Promise<{ data: StaffBoard } | { error: unknown }> {
  const [schedulesRes, timesheetsRes, workersRes] = await Promise.all([
    bq('/schedules'),
    bq('/timesheets'),
    fetchAllPages<WorkerApi>(bq, '/workers'),
  ])
  if (schedulesRes.error) return { error: schedulesRes.error }
  if (timesheetsRes.error) return { error: timesheetsRes.error }
  if ('error' in workersRes) return { error: workersRes.error }

  const schedules = (schedulesRes.data as ApiEnvelope<ScheduleApi[]>).data
  const schedule = [...schedules].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
  const timeZone = schedule?.hotel.timeZone
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())

  let entries: ScheduleEntryApi[] = []
  if (schedule) {
    const entriesRes = await bq(`/schedules/${schedule.id}/entries`)
    if (entriesRes.error) return { error: entriesRes.error }
    entries = (entriesRes.data as ApiEnvelope<ScheduleEntryApi[]>).data
  }

  /* La lista de timesheets viaja sin días: las marcas van por detalle, como en el web. */
  const sheets = (timesheetsRes.data as ApiEnvelope<TimesheetApi[]>).data
  const details = await Promise.all(sheets.map((sheet) => bq(`/timesheets/${sheet.id}`)))
  const timesheets = details
    .filter((res) => !res.error)
    .map((res) => (res.data as ApiEnvelope<TimesheetApi>).data)

  const workers = new Map(workersRes.data.map((worker) => [worker.id, worker]))
  const roster = new Set(entries.map((entry) => entry.worker.id))
  for (const worker of workersRes.data) {
    if (worker.state.code === 'PINK' || worker.state.code === 'GRAY') roster.add(worker.id)
  }

  const members = [...roster]
    .map((workerId): StaffMember | null => {
      const worker = workers.get(workerId)
      if (!worker) return null
      const shifts = entries.filter((entry) => entry.worker.id === workerId)
      const todayShift = shifts.find((entry) => entry.workDate === today) ?? null
      const pastShifts = new Map(
        shifts.filter((entry) => entry.workDate <= today).map((entry) => [entry.workDate, entry]),
      )
      const days = timesheets
        .filter((sheet) => sheet.worker.id === workerId)
        .flatMap((sheet) => sheet.days ?? [])
        .filter((day) => day.workDate <= today && day.punches.length > 0)
      const clockInOf = (workDate: string): string | undefined =>
        days
          .find((day) => day.workDate === workDate)
          ?.punches.find((punch) => punch.type === 'CLOCK_IN')?.serverAt
      const withShift = days.filter((day) => pastShifts.has(day.workDate))
      const onTime = withShift.filter((day) => {
        const clockIn = clockInOf(day.workDate)
        const shift = pastShifts.get(day.workDate)
        return clockIn !== undefined && shift !== undefined
          ? (new Date(clockIn).getTime() - new Date(shift.startsAt).getTime()) / 60_000 <=
              ON_TIME_MINUTES
          : false
      })

      return {
        workerId,
        fullName: worker.fullName,
        photoUrl: worker.photoUrl,
        phone: worker.phone,
        positionName: worker.position?.name ?? null,
        stateCode: worker.state.code,
        shift: todayShift ? { startsAt: todayShift.startsAt, endsAt: todayShift.endsAt } : null,
        clockInAt: clockInOf(today) ?? null,
        timeZone,
        isOperational: OPERATIONAL_STATES.has(worker.state.code),
        attendance: ratio(withShift.length, pastShifts.size),
        punctuality: ratio(onTime.length, withShift.length),
        emergencyContact: worker.emergencyContact,
        englishLevel: worker.englishLevel?.name ?? null,
        hiringModality: worker.hiringModality?.name ?? null,
      }
    })
    .filter((member): member is StaffMember => member !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  return {
    data: {
      members,
      withShiftToday: members.filter((member) => member.shift !== null).length,
      clockedInToday: members.filter((member) => member.clockInAt !== null).length,
      inStandBy: members.filter((member) => member.stateCode === 'PINK').length,
      inAccident: members.filter((member) => member.stateCode === 'GRAY').length,
    },
  }
}

export const staffAppApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    appStaffBoard: build.query<StaffBoard, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchBoard(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [
        { type: 'Worker' as const, id: 'LIST' },
        { type: 'Schedule' as const, id: 'LIST' },
      ],
    }),

    /**
     * Stand-by (Rosa) y Reportar (Rojo) son la MISMA transición del semáforo
     * (`POST /workers/:id/transitions`), con motivo obligatorio y nota opcional.
     */
    appStaffTransition: build.mutation<
      unknown,
      { workerId: string; toState: StaffTransition; reasonCode: string; note?: string }
    >({
      query: ({ workerId, toState, reasonCode, note }) => ({
        url: `/workers/${workerId}/transitions`,
        method: 'POST',
        body: { toState, reasonCode, ...(note ? { note } : {}) },
      }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'LIST' }],
    }),
  }),
})

export const { useAppStaffBoardQuery, useAppStaffTransitionMutation } = staffAppApi
