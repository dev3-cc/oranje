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

function entry(offset: number, workerName: string, start: string, end: string): ScheduleEntryApi {
  entrySequence += 1
  return {
    id: `sce-${String(entrySequence).padStart(4, '0')}`,
    workDate: dayIso(offset),
    startsAt: `${dayIso(offset)}T${start}:00.000Z`,
    endsAt: `${dayIso(offset)}T${end}:00.000Z`,
    minutes: 480,
    worker: { id: `wrk-${String(entrySequence)}`, fullName: workerName },
    assignmentId: `asg-${String(entrySequence)}`,
  }
}

const ENTRIES: ScheduleEntryApi[] = [
  entry(0, 'Ana Rivera Gómez', '07:00', '15:30'),
  entry(0, 'José Rivera', '07:00', '15:30'),
  entry(1, 'Ana Rivera Gómez', '07:00', '15:30'),
  entry(1, 'Rosa Navarro', '07:00', '15:30'),
  entry(2, 'Ana Rivera Gómez', '07:00', '15:30'),
  entry(3, 'José Rivera', '07:00', '15:30'),
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
