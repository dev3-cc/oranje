/*
 * ⚠ Import entre features, permitido SOLO aquí: la demanda sale de
 * `/requisitions`, cuyo mock vive en Requisiciones. Con mocks apagados, no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, ScheduleApi, ScheduleEntryApi } from '@/shared/types/apiContract.types'

/**
 * Fixtures de `operations.schedule` en la forma CRUDA del contrato real: la
 * semana ACTUAL de Villas Coral (el hotel de `req-0005`), con programados que
 * casan con su cobertura 3/6.
 */

const MS_PER_DAY = 86_400_000

function mondayOfThisWeek(): string {
  const now = new Date()
  const weekday = (now.getUTCDay() + 6) % 7
  return new Date(now.getTime() - weekday * MS_PER_DAY).toISOString().slice(0, 10)
}

const WEEK_START = mondayOfThisWeek()

function dayIso(offset: number): string {
  return new Date(new Date(WEEK_START).getTime() + offset * MS_PER_DAY).toISOString().slice(0, 10)
}

const SCHEDULE: ScheduleApi = {
  id: 'sch-0001',
  hotel: { id: 'htl-psp-0015', name: 'Villas Coral', timeZone: 'America/New_York' },
  weekStart: WEEK_START,
  weekEnd: dayIso(6),
  entryCount: 6,
  createdAt: `${WEEK_START}T08:00:00.000Z`,
}

let entrySequence = 0

/** Los ids son los del Pool: Mi Personal cruza el turno con el semáforo. */
function entry(
  offset: number,
  worker: { id: string; fullName: string },
  start: string,
  end: string,
): ScheduleEntryApi {
  entrySequence += 1
  return {
    id: `sce-${String(entrySequence).padStart(4, '0')}`,
    workDate: dayIso(offset),
    startsAt: `${dayIso(offset)}T${start}:00.000Z`,
    endsAt: `${dayIso(offset)}T${end}:00.000Z`,
    minutes: 480,
    worker,
    assignmentId: `asg-${String(entrySequence)}`,
  }
}

const ANA = { id: 'wrk-0001', fullName: 'Ana Rivera Gómez' }
const LUIS = { id: 'wrk-0002', fullName: 'Luis Cabrera' }
const MARIA = { id: 'wrk-0003', fullName: 'María Fernanda Ortiz' }
const JULIA = { id: 'wrk-0005', fullName: 'Julia Mendoza' }

/** El offset de HOY dentro de la semana, para que Mi Personal siempre tenga turnos. */
const TODAY_OFFSET = (new Date().getUTCDay() + 6) % 7
const NEXT_OFFSET = (TODAY_OFFSET + 1) % 7

const ENTRIES: ScheduleEntryApi[] = [
  entry(TODAY_OFFSET, ANA, '07:00', '15:30'),
  entry(TODAY_OFFSET, LUIS, '08:00', '16:00'),
  entry(TODAY_OFFSET, JULIA, '08:00', '16:00'),
  entry(NEXT_OFFSET, ANA, '07:00', '15:30'),
  entry(NEXT_OFFSET, MARIA, '07:00', '15:30'),
  entry(NEXT_OFFSET, LUIS, '08:00', '16:00'),
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/schedules',
    resolve: (): ApiEnvelope<ScheduleApi[]> => ({ data: [SCHEDULE] }),
  },
  {
    method: 'GET',
    path: '/schedules/:scheduleId/entries',
    resolve: (): ApiEnvelope<ScheduleEntryApi[]> => ({ data: ENTRIES }),
  },
]

let areRoutesRegistered = false

export function registerScheduleMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  registerRequisitionsMocks()
}
