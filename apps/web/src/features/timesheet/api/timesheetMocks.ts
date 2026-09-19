/* Solo `/me` es ajeno: lo registra la sesión. Con mocks apagados, no-op. */
import '@/app/sessionApi'
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type {
  ApiEnvelope,
  TimesheetApi,
  TimesheetDayApi,
  TimesheetPunchApi,
} from '@/shared/types/apiContract.types'

/**
 * Fixtures de `operations.timesheet` en la forma CRUDA del contrato real. La
 * semana es la ACTUAL (lunes derivado de hoy): el grid siempre enseña fechas
 * vivas, como contra la API.
 */

const MS_PER_DAY = 86_400_000

/** El lunes de esta semana, en ISO sin hora. */
function mondayOfThisWeek(): string {
  const now = new Date()
  const weekday = (now.getUTCDay() + 6) % 7
  return new Date(now.getTime() - weekday * MS_PER_DAY).toISOString().slice(0, 10)
}

const WEEK_START = mondayOfThisWeek()

function dayIso(offset: number): string {
  return new Date(new Date(WEEK_START).getTime() + offset * MS_PER_DAY).toISOString().slice(0, 10)
}

let punchSequence = 0

function punch(input: {
  type: string
  time: string
  date: string
  inside?: boolean | null
  manual?: boolean
  reason?: string
}): TimesheetPunchApi {
  punchSequence += 1
  return {
    id: `pm-${String(punchSequence).padStart(4, '0')}`,
    type: input.type,
    serverAt: `${input.date}T${input.time}:00.000Z`,
    deviceAt: input.manual ? null : `${input.date}T${input.time}:00.000Z`,
    insideGeofence: input.manual ? null : (input.inside ?? true),
    isManual: input.manual ?? false,
    manualReason: input.reason ?? null,
  }
}

let daySequence = 0

function fullDay(input: {
  offset: number
  hasAnomaly?: boolean
  reviewNote?: string | null
  outOfFence?: boolean
}): TimesheetDayApi {
  daySequence += 1
  const date = dayIso(input.offset)
  return {
    id: `tsd-${String(daySequence).padStart(4, '0')}`,
    workDate: date,
    grossMinutes: 540,
    netMinutes: 510,
    lunchDeductionMinutes: 30,
    actualLunchMinutes: 30,
    overtimeMinutes: 0,
    isAbsence: false,
    hasAnomaly: input.hasAnomaly ?? false,
    reviewNote: input.reviewNote ?? null,
    punches: [
      punch({ type: 'CLOCK_IN', time: '07:00', date }),
      punch({ type: 'LUNCH_OUT', time: '12:30', date }),
      punch({ type: 'LUNCH_IN', time: '13:00', date }),
      punch({ type: 'CLOCK_OUT', time: '16:00', date, inside: !input.outOfFence }),
    ],
  }
}

function absenceDay(offset: number): TimesheetDayApi {
  daySequence += 1
  return {
    id: `tsd-${String(daySequence).padStart(4, '0')}`,
    workDate: dayIso(offset),
    grossMinutes: 0,
    netMinutes: 0,
    lunchDeductionMinutes: 0,
    actualLunchMinutes: null,
    overtimeMinutes: 0,
    isAbsence: true,
    hasAnomaly: false,
    reviewNote: null,
    punches: [],
  }
}

interface StoredTimesheet extends TimesheetApi {
  days: TimesheetDayApi[]
}

function totalsOf(days: TimesheetDayApi[]): {
  grossMinutes: number
  netMinutes: number
  overtimeMinutes: number
} {
  return {
    grossMinutes: days.reduce((total, day) => total + day.grossMinutes, 0),
    netMinutes: days.reduce((total, day) => total + day.netMinutes, 0),
    overtimeMinutes: days.reduce((total, day) => total + day.overtimeMinutes, 0),
  }
}

const timesheets: StoredTimesheet[] = [
  {
    id: 'ts-0001',
    worker: { id: 'wrk-0001', fullName: 'Ana Rivera Gómez' },
    requisitionId: 'a1b2c3d4-0000-7000-8000-000000000001',
    weekStart: WEEK_START,
    weekEnd: dayIso(6),
    status: 'OPEN',
    approvedAt: null,
    days: [
      fullDay({ offset: 0, reviewNote: 'Jornada normal' }),
      fullDay({ offset: 1, reviewNote: 'Jornada normal' }),
      /** La anomalía de la maqueta: salió fuera de la geocerca. */
      fullDay({ offset: 2, hasAnomaly: true, outOfFence: true }),
      fullDay({ offset: 3 }),
    ],
  },
  {
    id: 'ts-0002',
    worker: { id: 'wrk-0002', fullName: 'Luis Cabrera' },
    requisitionId: 'a1b2c3d4-0000-7000-8000-000000000002',
    weekStart: WEEK_START,
    weekEnd: dayIso(6),
    status: 'PENDING_APPROVAL',
    approvedAt: null,
    days: [
      fullDay({ offset: 0, reviewNote: 'ok' }),
      fullDay({ offset: 1, reviewNote: 'ok' }),
      fullDay({ offset: 2, reviewNote: 'ok' }),
      absenceDay(3),
    ],
  },
  {
    id: 'ts-0003',
    worker: { id: 'wrk-0005', fullName: 'Julia Mendoza' },
    requisitionId: 'a1b2c3d4-0000-7000-8000-000000000001',
    weekStart: WEEK_START,
    weekEnd: dayIso(6),
    status: 'APPROVED',
    approvedAt: `${dayIso(4)}T18:00:00.000Z`,
    days: [fullDay({ offset: 0, reviewNote: 'ok' }), fullDay({ offset: 1, reviewNote: 'ok' })],
  },
  /**
   * La semana ANTERIOR: existe para que ‹ ›, «Hoy» y el tirador tengan a dónde
   * ir en local. Cerrada y aprobada, como estaría en la vida real.
   */
  {
    id: 'ts-0004',
    worker: { id: 'wrk-0001', fullName: 'Ana Rivera Gómez' },
    requisitionId: 'a1b2c3d4-0000-7000-8000-000000000001',
    weekStart: dayIso(-7),
    weekEnd: dayIso(-1),
    status: 'APPROVED',
    approvedAt: `${dayIso(-1)}T18:00:00.000Z`,
    days: [
      fullDay({ offset: -7, reviewNote: 'ok' }),
      fullDay({ offset: -6, reviewNote: 'ok' }),
      fullDay({ offset: -5, reviewNote: 'ok' }),
      fullDay({ offset: -4, reviewNote: 'ok' }),
      fullDay({ offset: -3, reviewNote: 'ok' }),
    ],
  },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/timesheets',
    resolve: ({ search }): ApiEnvelope<TimesheetApi[]> => {
      const status = search.get('status')
      const items = timesheets.filter((sheet) => !status || sheet.status === status)
      // La lista viaja SIN días, como el backend: el detalle los trae.
      return { data: items.map(({ days: _days, ...sheet }) => sheet) }
    },
  },
  {
    method: 'GET',
    path: '/timesheets/:timesheetId',
    resolve: ({ params }): ApiEnvelope<TimesheetApi> => {
      const found = timesheets.find((sheet) => sheet.id === params.timesheetId)
      if (!found) throw new Error('TIMESHEET_NOT_FOUND')
      return { data: { ...found, totals: totalsOf(found.days) } }
    },
  },
  {
    method: 'POST',
    path: '/timesheet-days/:dayId/review',
    resolve: ({ params, body }): ApiEnvelope<TimesheetDayApi> => {
      const note = ((body ?? {}) as { note?: string }).note
      if (!note) throw new Error('La nota de revisión es obligatoria')
      for (const sheet of timesheets) {
        const day = sheet.days.find((item) => item.id === params.dayId)
        if (day) {
          day.reviewNote = note
          day.hasAnomaly = false
          return { data: day }
        }
      }
      throw new Error('DAY_NOT_FOUND')
    },
  },
  {
    method: 'POST',
    path: '/timesheets/:timesheetId/submit',
    resolve: ({ params }): ApiEnvelope<TimesheetApi> => {
      const found = timesheets.find((sheet) => sheet.id === params.timesheetId)
      if (!found) throw new Error('TIMESHEET_NOT_FOUND')
      if (found.status !== 'OPEN') throw new Error('TIMESHEET_NOT_OPEN')
      if (found.days.some((day) => day.hasAnomaly)) throw new Error('ANOMALIES_PENDING')
      found.status = 'PENDING_APPROVAL'
      return { data: { ...found } }
    },
  },
  {
    method: 'POST',
    path: '/timesheets/:timesheetId/approve',
    resolve: ({ params }): ApiEnvelope<TimesheetApi> => {
      const found = timesheets.find((sheet) => sheet.id === params.timesheetId)
      if (!found) throw new Error('TIMESHEET_NOT_FOUND')
      if (found.status !== 'PENDING_APPROVAL') throw new Error('TIMESHEET_NOT_PENDING')
      found.status = 'APPROVED'
      found.approvedAt = new Date().toISOString()
      return { data: { ...found } }
    },
  },
  {
    method: 'POST',
    path: '/punches/manual',
    /** El mock solo confirma: el grid recarga del store y la marca no se simula. */
    resolve: (): { data: null } => ({ data: null }),
  },
]

let areRoutesRegistered = false

export function registerTimesheetMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // La marca manual resuelve el assignment en `/requisitions/:id/assignments`,
  // cuyo mock registra Requisiciones.
  registerRequisitionsMocks()
}
