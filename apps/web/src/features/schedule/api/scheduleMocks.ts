/*
 * ⚠ Import entre features, permitido SOLO aquí: la demanda sale de
 * `/requisitions`, cuyo mock vive en Requisiciones. Con mocks apagados, no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, ScheduleApi, ScheduleEntryApi } from '@/shared/types/apiContract.types'

/**
 * Fixtures de `operations.schedule` en la forma CRUDA del contrato real:
 * TRES semanas de Villas Coral (el hotel de `req-0005`) — la actual y las dos
 * anteriores, como las 3 semanas reales verificadas en dev para Xcaret — para
 * poder probar la navegación ‹ › y el mini-calendario contra datos de verdad,
 * no una sola semana. Cada schedule cubre programados que casan con la
 * cobertura 3/6 de la demanda.
 */

const MS_PER_DAY = 86_400_000

function mondayOfThisWeek(): string {
  const now = new Date()
  const weekday = (now.getUTCDay() + 6) % 7
  return new Date(now.getTime() - weekday * MS_PER_DAY).toISOString().slice(0, 10)
}

function addDays(iso: string, offset: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + offset * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

const CURRENT_WEEK_START = mondayOfThisWeek()
const HOTEL = { id: 'htl-psp-0015', name: 'Villas Coral', timeZone: 'America/New_York' }

const ANA = { id: 'wrk-0001', fullName: 'Ana Rivera Gómez' }
const LUIS = { id: 'wrk-0002', fullName: 'Luis Cabrera' }
const MARIA = { id: 'wrk-0003', fullName: 'María Fernanda Ortiz' }
const JULIA = { id: 'wrk-0005', fullName: 'Julia Mendoza' }

let entrySequence = 0

function entry(
  weekStart: string,
  offset: number,
  worker: { id: string; fullName: string },
  start: string,
  end: string,
): ScheduleEntryApi {
  entrySequence += 1
  const workDate = addDays(weekStart, offset)
  return {
    id: `sce-${String(entrySequence).padStart(4, '0')}`,
    workDate,
    startsAt: `${workDate}T${start}:00.000Z`,
    endsAt: `${workDate}T${end}:00.000Z`,
    minutes: 480,
    worker,
    assignmentId: `asg-${String(entrySequence)}`,
  }
}

/** Tres semanas: la actual y las dos anteriores, más viejas primero. */
const WEEK_STARTS = [
  addDays(CURRENT_WEEK_START, -14),
  addDays(CURRENT_WEEK_START, -7),
  CURRENT_WEEK_START,
]

const SCHEDULES: ScheduleApi[] = WEEK_STARTS.map((weekStart, index) => ({
  id: `sch-000${String(index + 1)}`,
  hotel: HOTEL,
  weekStart,
  weekEnd: addDays(weekStart, 6),
  entryCount: 6,
  createdAt: `${weekStart}T08:00:00.000Z`,
}))

/** El offset de HOY dentro de la semana actual, para que Mi Personal siempre tenga turnos. */
const TODAY_OFFSET = (new Date().getUTCDay() + 6) % 7
const NEXT_OFFSET = (TODAY_OFFSET + 1) % 7

/** Entradas por schedule: cada semana repite el mismo patrón de cobertura (3/6). */
const ENTRIES_BY_SCHEDULE: Record<string, ScheduleEntryApi[]> = {
  [SCHEDULES[0]!.id]: [
    entry(WEEK_STARTS[0]!, 1, ANA, '07:00', '15:30'),
    entry(WEEK_STARTS[0]!, 1, LUIS, '08:00', '16:00'),
    entry(WEEK_STARTS[0]!, 1, JULIA, '08:00', '16:00'),
    entry(WEEK_STARTS[0]!, 2, ANA, '07:00', '15:30'),
    entry(WEEK_STARTS[0]!, 2, MARIA, '07:00', '15:30'),
    entry(WEEK_STARTS[0]!, 3, LUIS, '08:00', '16:00'),
  ],
  [SCHEDULES[1]!.id]: [
    entry(WEEK_STARTS[1]!, 0, ANA, '07:00', '15:30'),
    entry(WEEK_STARTS[1]!, 0, JULIA, '08:00', '16:00'),
    entry(WEEK_STARTS[1]!, 2, LUIS, '08:00', '16:00'),
    entry(WEEK_STARTS[1]!, 2, MARIA, '07:00', '15:30'),
    entry(WEEK_STARTS[1]!, 4, ANA, '07:00', '15:30'),
    entry(WEEK_STARTS[1]!, 5, LUIS, '08:00', '16:00'),
  ],
  [SCHEDULES[2]!.id]: [
    entry(WEEK_STARTS[2]!, TODAY_OFFSET, ANA, '07:00', '15:30'),
    entry(WEEK_STARTS[2]!, TODAY_OFFSET, LUIS, '08:00', '16:00'),
    entry(WEEK_STARTS[2]!, TODAY_OFFSET, JULIA, '08:00', '16:00'),
    entry(WEEK_STARTS[2]!, NEXT_OFFSET, ANA, '07:00', '15:30'),
    entry(WEEK_STARTS[2]!, NEXT_OFFSET, MARIA, '07:00', '15:30'),
    entry(WEEK_STARTS[2]!, NEXT_OFFSET, LUIS, '08:00', '16:00'),
  ],
}

let addedEntrySequence = 0

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/schedules',
    resolve: (): ApiEnvelope<ScheduleApi[]> => ({ data: SCHEDULES }),
  },
  {
    method: 'GET',
    path: '/schedules/:scheduleId/entries',
    resolve: ({ params }): ApiEnvelope<ScheduleEntryApi[]> => ({
      data: ENTRIES_BY_SCHEDULE[params.scheduleId ?? ''] ?? [],
    }),
  },
  /** «Agregar turno»: crea la semana si hace falta (el mock ya trae las 3 sembradas). */
  {
    method: 'POST',
    path: '/schedules',
    resolve: ({ body }): ApiEnvelope<ScheduleApi> => {
      const weekStart = (body as { weekStart: string }).weekStart
      const existing = SCHEDULES.find((schedule) => schedule.weekStart === weekStart)
      if (existing) return { data: existing }
      const created: ScheduleApi = {
        id: `sch-mock-${String(SCHEDULES.length + 1)}`,
        hotel: HOTEL,
        weekStart,
        weekEnd: addDays(weekStart, 6),
        entryCount: 0,
        createdAt: new Date().toISOString(),
      }
      SCHEDULES.push(created)
      ENTRIES_BY_SCHEDULE[created.id] = []
      return { data: created }
    },
  },
  {
    method: 'POST',
    path: '/schedules/:scheduleId/entries',
    resolve: ({ params, body }): ApiEnvelope<ScheduleEntryApi> => {
      const dto = body as {
        assignmentId: string
        workDate: string
        startTime: string
        endTime: string
      }
      addedEntrySequence += 1
      const created: ScheduleEntryApi = {
        id: `sce-added-${String(addedEntrySequence)}`,
        workDate: dto.workDate,
        startsAt: `${dto.workDate}T${dto.startTime}:00.000Z`,
        endsAt: `${dto.workDate}T${dto.endTime}:00.000Z`,
        minutes: 0,
        worker: { id: 'wrk-mock', fullName: 'Turno agregado' },
        assignmentId: dto.assignmentId,
      }
      const scheduleId = params.scheduleId ?? ''
      ENTRIES_BY_SCHEDULE[scheduleId] = [...(ENTRIES_BY_SCHEDULE[scheduleId] ?? []), created]
      return { data: created }
    },
  },
]

let areRoutesRegistered = false

export function registerScheduleMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  registerRequisitionsMocks()
}
