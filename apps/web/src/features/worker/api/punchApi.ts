import { workerApi } from './workerApi'

import type { ApiEnvelope, TimesheetApi, TimesheetPunchApi } from '@/shared/types/apiContract.types'

/**
 * El ponche del Colaborador, compuesto del contrato real (D-28):
 * `GET /schedules/me` da el turno de hoy, `GET /timesheets/me` las marcas
 * ya hechas, y `POST /punches` registra la nueva. Dos huecos del contrato
 * están encargados al back: `assignmentId` en el turno propio (sin él no
 * hay a qué ponchar) y los días con marcas en `/timesheets/me`.
 */
export type PunchType = 'CLOCK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CLOCK_OUT'

export const PUNCH_ORDER: PunchType[] = ['CLOCK_IN', 'LUNCH_OUT', 'LUNCH_IN', 'CLOCK_OUT']

export const PUNCH_LABEL: Record<PunchType, string> = {
  CLOCK_IN: 'Entrada',
  LUNCH_OUT: 'Salida a lunch',
  LUNCH_IN: 'Regreso de lunch',
  CLOCK_OUT: 'Salida',
}

/** Entrada y Salida exigen foto (D-08); las de lunch no. */
export const NEEDS_PHOTO: ReadonlySet<PunchType> = new Set(['CLOCK_IN', 'CLOCK_OUT'])

/** `GET /schedules/me` — el `assignmentId` llega cuando el back lo agregue. */
export interface MyShiftApi {
  id: string
  workDate: string
  startsAt: string
  endsAt: string
  hotel: string
  position: string
  assignmentId?: string
  /** La foto del hotel (Places, compuesta al leer — D-34). */
  hotelPhotoUrl?: string | null
  /** IANA del hotel (`commercial.hotel.time_zone`): las horas del turno se leen ahí, no en el reloj del teléfono. */
  hotelTimeZone?: string
}

export interface TodayPunching {
  shift: MyShiftApi | null
  /** Las marcas de hoy; `null` cuando el contrato aún no las trae. */
  punches: TimesheetPunchApi[] | null
}

export interface PunchRequest {
  /** Opcional desde el encargo 4: el servidor resuelve el turno de hoy del token. */
  assignmentId?: string
  type: PunchType
  latitude: number
  longitude: number
  /** Ruta devuelta por `POST /files` (PUNCH_PHOTO), obligatoria en Entrada/Salida. */
  photoPath?: string
}

export interface PunchResultApi {
  punch: TimesheetPunchApi
  dayId: string
  grossMinutes: number
  hasAnomaly: boolean
}

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** La semana en curso, de lunes a domingo, en fechas locales. */
function currentWeekRange(): { from: string; to: string } {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  const weekday = (local.getUTCDay() + 6) % 7
  const monday = new Date(local)
  monday.setUTCDate(local.getUTCDate() - weekday)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) }
}

export const punchApi = workerApi.injectEndpoints({
  endpoints: (build) => ({
    getTodayPunching: build.query<TodayPunching, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const today = todayIso()
        const [shiftRes, sheetsRes] = await Promise.all([
          bq({ url: '/schedules/me', params: { from: today, to: today } }),
          bq('/timesheets/me'),
        ])
        if (shiftRes.error) return { error: shiftRes.error as never }
        if (sheetsRes.error) return { error: sheetsRes.error as never }

        const shifts = (shiftRes.data as ApiEnvelope<MyShiftApi[]>).data
        const sheets = (sheetsRes.data as ApiEnvelope<TimesheetApi[]>).data
        const current = sheets.find((sheet) => sheet.weekStart <= today && today <= sheet.weekEnd)
        const day = current?.days?.find((item) => item.workDate === today)

        return {
          data: {
            shift: shifts[0] ?? null,
            punches: current?.days === undefined ? null : (day?.punches ?? []),
          },
        }
      },
      providesTags: [{ type: 'PunchMark' as const, id: 'TODAY' }],
    }),

    /** Mis turnos de la semana en curso (lunes a domingo), tal cual los sirve `/schedules/me`. */
    getMyWeekShifts: build.query<MyShiftApi[], void>({
      query: () => ({ url: '/schedules/me', params: currentWeekRange() }),
      transformResponse: (raw: ApiEnvelope<MyShiftApi[]>) =>
        [...raw.data].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      providesTags: [{ type: 'PunchMark' as const, id: 'WEEK' }],
    }),

    punch: build.mutation<PunchResultApi, PunchRequest>({
      query: (body) => ({
        url: '/punches',
        method: 'POST',
        /** `deviceAt` es la hora real del hecho según el teléfono (D-08). */
        body: { ...body, deviceAt: new Date().toISOString() },
      }),
      transformResponse: (raw: ApiEnvelope<PunchResultApi>) => raw.data,
      invalidatesTags: [{ type: 'PunchMark' as const, id: 'TODAY' }],
    }),
  }),
})

export const { useGetTodayPunchingQuery, useGetMyWeekShiftsQuery, usePunchMutation } = punchApi
