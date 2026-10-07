import { describe, expect, it } from 'vitest'

import type { Punch } from '../types/observability.types'

import { hotelKpis } from './hotelKpis'
import { type Kpi, kpiStatus } from './kpi'
import { periodOf } from './period'
import { dayOneNoShow, recruitmentKpis } from './recruitmentKpis'
import { salesKpis } from './salesKpis'
import { groupShifts, isComplete, lunchMinutes, workerKpis } from './workerKpis'

import type {
  AssignmentApi,
  ProspectApi,
  RequisitionApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/* Miércoles 7 de octubre de 2026, 15:00 local: la semana empezó el lunes 5. */
const NOW = new Date(2026, 9, 7, 15, 0, 0)
const WEEK = periodOf('week', NOW)
const at = (day: number, hour = 9, minute = 0): string =>
  new Date(2026, 9, day, hour, minute).toISOString()

function kpi(list: Kpi[], id: Kpi['id']): Kpi {
  const found = list.find((item) => item.id === id)
  if (!found) throw new Error(`falta ${id}`)
  return found
}

function prospect(overrides: Partial<ProspectApi>): ProspectApi {
  return {
    id: Math.random().toString(36),
    hotel: { id: 'h', name: 'H', photoUrl: null, zone: { id: 'z', name: 'Z' } },
    owner: { id: 'u', fullName: 'U' },
    state: { code: 'GREEN', color: '', name: '' },
    stateSince: at(1),
    needDescription: null,
    openedAt: at(1),
    closedAt: null,
    attemptCount: 0,
    isOpen: true,
    lastAttempt: null,
    lastProposal: null,
    ...overrides,
  } as ProspectApi
}

function requisition(overrides: Partial<RequisitionApi> & { start?: string }): RequisitionApi {
  const { start = '2026-10-08', ...rest } = overrides
  return {
    id: Math.random().toString(36),
    number: 'R',
    hotel: { id: 'h1', name: 'H', timeZone: undefined },
    state: { code: 'GREEN', color: '', name: '' },
    areaManagerUserId: null,
    authorizedBy: null,
    authorizedAt: null,
    inspectorId: null,
    positions: [{ startDate: start, quantity: 2, filled: 1, urgency: null } as never],
    totalSlots: 2,
    filledSlots: 1,
    createdAt: at(5),
    updatedAt: null,
    ...rest,
  } as RequisitionApi
}

function punch(type: Punch['type'], iso: string, overrides: Partial<Punch> = {}): Punch {
  return {
    id: Math.random().toString(36),
    type,
    serverAt: iso,
    insideGeofence: true,
    isManual: false,
    workerId: 'w1',
    workerFullName: 'W',
    hotelId: 'h1',
    hotelName: 'H',
    hotelTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    scheduledStart: null,
    lateMinutes: null,
    ...overrides,
  }
}

describe('periodo', () => {
  it('la semana empieza el lunes a las 00:00', () => {
    expect(WEEK.from).toEqual(new Date(2026, 9, 5, 0, 0, 0))
    expect(periodOf('month', NOW).from).toEqual(new Date(2026, 9, 1))
  })
})

describe('escala de metas', () => {
  it('compara contra la meta y no colorea lo que no tiene meta', () => {
    expect(kpiStatus({ id: 'salesConversion', value: 0.25 })).toBe('ON_TARGET')
    expect(kpiStatus({ id: 'salesConversion', value: 0.1 })).toBe('OFF_TARGET')
    expect(kpiStatus({ id: 'workerShortLunch', value: 1 })).toBe('OFF_TARGET')
    expect(kpiStatus({ id: 'salesStale', value: 9 })).toBe('NO_TARGET')
    expect(kpiStatus({ id: 'salesConversion', value: null })).toBe('NO_DATA')
  })
})

describe('Ventas', () => {
  it('la conversión solo cuenta los ciclos que terminaron en el periodo', () => {
    const list = salesKpis({
      period: WEEK,
      prospects: [
        prospect({ state: { code: 'ORANGE' } as never, stateSince: at(6), isOpen: false }),
        prospect({ state: { code: 'RED' } as never, closedAt: at(6), isOpen: false }),
        prospect({ state: { code: 'BLACK' } as never, closedAt: at(5), isOpen: false }),
        // Convertido antes del periodo: no cuenta.
        prospect({ state: { code: 'ORANGE' } as never, stateSince: at(1), isOpen: false }),
        // Abierto y sin intento desde hace 9 días: estancado.
        prospect({ openedAt: new Date(2026, 8, 28).toISOString() }),
        // Abierto hace 6 días: todavía no.
        prospect({}),
      ],
      attempts: [
        { attemptType: 'COLD_VISIT', outcome: 'NO_ANSWER', occurredAt: at(6) },
        { attemptType: 'CALL', outcome: 'MEETING_SET', occurredAt: at(6) },
        { attemptType: 'COLD_VISIT', outcome: 'NO_ANSWER', occurredAt: at(2) },
      ] as never,
      clientHotels: [{ id: 'h1' }, { id: 'h2' }] as never,
      requisitions: [requisition({ hotel: { id: 'h1', name: 'H' } })],
      onboarding: undefined,
    })
    expect(kpi(list, 'salesConversion')).toMatchObject({ ratio: { part: 1, whole: 3 } })
    expect(kpi(list, 'salesLoss')).toMatchObject({ ratio: { part: 1, whole: 3 } })
    expect(kpi(list, 'salesVisits').value).toBe(1)
    expect(kpi(list, 'salesMeetings').value).toBe(1)
    expect(kpi(list, 'salesStale').value).toBe(1)
    expect(kpi(list, 'salesHotelsWithoutRequisition').value).toBe(1)
    expect(kpi(list, 'salesOnboardingCycle')).toMatchObject({ value: null, empty: 'NO_DATA' })
  })
})

describe('Hotel', () => {
  it('anticipación, eliminadas y tiempo para autorizar del periodo', () => {
    const list = hotelKpis({
      period: WEEK,
      requisitions: [
        requisition({ createdAt: at(5), start: '2026-10-12', authorizedAt: at(5, 15) }),
        requisition({ createdAt: at(6), start: '2026-10-08', state: { code: 'PURPLE' } as never }),
        requisition({ createdAt: at(1), start: '2026-10-02' }),
      ],
      pendingWeeks: 3,
      weekApproval: undefined,
      worker: undefined,
    })
    expect(kpi(list, 'hotelLeadTime').value).toBe(4.5)
    expect(kpi(list, 'hotelCancelled')).toMatchObject({ ratio: { part: 1, whole: 2 } })
    expect(kpi(list, 'hotelAuthorizeHours').value).toBeCloseTo(6)
    expect(kpi(list, 'hotelUnapprovedWeeks').value).toBe(3)
  })
})

describe('Reclutamiento', () => {
  it('fill rate de las que empiezan en el periodo', () => {
    const list = recruitmentKpis({
      period: WEEK,
      requisitions: [
        requisition({ start: '2026-10-06', totalSlots: 4, filledSlots: 3 }),
        requisition({ start: '2026-10-20', totalSlots: 10, filledSlots: 0 }),
        requisition({ start: '2026-10-06', state: { code: 'PURPLE' } as never }),
      ],
      workers: [{ createdAt: at(6) }, { createdAt: at(1) }] as WorkerApi[],
      requisitionLight: undefined,
      dayOne: null,
    })
    expect(kpi(list, 'recruitmentFillRate')).toMatchObject({ value: 0.75 })
    expect(kpi(list, 'recruitmentPoolIntake').value).toBe(1)
    expect(kpi(list, 'recruitmentNoShow')).toMatchObject({ value: null, empty: 'NO_DATA' })
  })

  it('no-show: primer día ya pasado y sin ponche ese día', () => {
    const req = requisition({ start: '2026-10-05' })
    const assignment = (id: string, createdAt = at(1)): AssignmentApi =>
      ({ id, status: 'ACTIVE', worker: { id, fullName: id }, createdAt }) as AssignmentApi
    const result = dayOneNoShow(
      [
        {
          requisition: req,
          assignments: [
            assignment('w1'),
            assignment('w2'),
            // Asignado hoy: su primer día no ha terminado.
            assignment('w3', at(7)),
          ],
        },
      ],
      [punch('CLOCK_IN', at(5, 8), { workerId: 'w1' })],
      WEEK,
    )
    expect(result).toEqual({ expected: 2, noShows: 1 })
  })
})

describe('Colaborador', () => {
  const day6 = [
    punch('CLOCK_IN', at(6, 8)),
    punch('LUNCH_OUT', at(6, 12)),
    punch('LUNCH_IN', at(6, 12, 10)),
    punch('CLOCK_OUT', at(6, 17)),
  ]

  it('agrupa por jornada y mide la comida', () => {
    const [shift] = groupShifts(day6)
    expect(shift && isComplete(shift)).toBe(true)
    expect(shift && lunchMinutes(shift)).toBe(10)
  })

  it('no cuenta como incompleta la jornada de hoy', () => {
    const list = workerKpis({
      period: WEEK,
      punches: [
        ...day6,
        punch('CLOCK_IN', at(5, 8), { workerId: 'w2' }),
        punch('CLOCK_IN', at(7, 8), { workerId: 'w3', insideGeofence: false, isManual: true }),
      ],
      workers: [
        { state: { code: 'BLACK' }, isProfileComplete: true },
        { state: { code: 'GREEN' }, isProfileComplete: false },
      ] as WorkerApi[],
    })
    expect(kpi(list, 'workerCompleteShifts')).toMatchObject({ ratio: { part: 1, whole: 2 } })
    expect(kpi(list, 'workerShiftsInProgress').value).toBe(1)
    expect(kpi(list, 'workerShortLunch').value).toBe(1)
    expect(kpi(list, 'workerOutsideGeofence').value).toBe(1)
    expect(kpi(list, 'workerPunctuality')).toMatchObject({ value: null, empty: 'NO_SOURCE' })
    expect(kpi(list, 'workerBlacklist').value).toBe(0.5)
  })
})
