import { describe, expect, it } from 'vitest'

import { periodOf } from './period'
import { coveredAt, participantsAt, recruiterTimes, recruitmentTimes } from './recruitmentTiming'

import type {
  AssignmentApi,
  RequisitionApi,
  RequisitionJournalEntryApi,
} from '@/shared/types/apiContract.types'

const NOW = new Date(2026, 9, 7, 15, 0, 0)
const WEEK = periodOf('week', NOW)
const at = (day: number, hour = 9): string => new Date(2026, 9, day, hour).toISOString()

const requisition = (overrides: Partial<RequisitionApi> = {}): RequisitionApi =>
  ({
    id: 'r1',
    authorizedAt: at(5, 9),
    totalSlots: 2,
    filledSlots: 2,
    ...overrides,
  }) as RequisitionApi

const entry = (
  eventType: string,
  actorName: string,
  occurredAt: string,
): RequisitionJournalEntryApi => ({
  id: `${eventType}-${actorName}-${occurredAt}`,
  eventType,
  actorName,
  actorRole: 'ROL-R-01',
  payload: null,
  occurredAt,
})

const assignment = (id: string, createdAt: string, status = 'ACTIVE'): AssignmentApi =>
  ({ id, status, createdAt, worker: { id, fullName: id } }) as AssignmentApi

describe('tiempos de Reclutamiento', () => {
  it('cubierta: la asignación que completó los lugares, sin contar canceladas', () => {
    const list = [
      assignment('a1', at(5, 12)),
      assignment('a2', at(6, 10), 'CANCELLED'),
      assignment('a3', at(6, 15)),
    ]
    expect(coveredAt(requisition(), list)).toBe(at(6, 15))
    expect(coveredAt(requisition({ filledSlots: 1 }), list)).toBeNull()
  })

  it('quién tenía la requisición en un momento', () => {
    const entries = [
      entry('RECRUITER_JOINED', 'Rita', at(5, 10)),
      entry('RECRUITER_JOINED', 'Sara', at(5, 11)),
      entry('RECRUITER_LEFT', 'Sara', at(6, 9)),
    ]
    expect([...participantsAt(entries, at(5, 12)).keys()]).toEqual(['Rita', 'Sara'])
    expect([...participantsAt(entries, at(6, 12)).keys()]).toEqual(['Rita'])
  })

  it('del departamento: atención, cobertura y tiempo por persona', () => {
    const times = recruitmentTimes(
      {
        requisitions: [requisition(), requisition({ id: 'r2', filledSlots: 0 })],
        journals: { r1: [entry('RECRUITER_JOINED', 'Rita', at(5, 13))], r2: [] },
        assignments: {
          r1: [assignment('a1', at(5, 13)), assignment('a2', at(6, 13))],
          r2: [],
        },
      },
      WEEK,
    )
    // r1: autorizada 9:00, tomada 13:00 → 4 h. r2 autorizada y sin tomar.
    expect(times.attentionHours).toBeCloseTo(4)
    expect(times.untaken).toBe(1)
    // Cubierta el 6 a las 13:00: 28 h después de autorizarse.
    expect(times.fillDays).toBeCloseTo(28 / 24)
    // Desde que se tomó: 0 h y 24 h.
    expect(times.perPersonDays).toBeCloseTo(0.5)
  })

  it('por reclutadora: lo que tardó en tomarla y cada persona mientras la tenía', () => {
    const byName = recruiterTimes(
      {
        requisitions: [requisition()],
        journals: {
          r1: [
            entry('RECRUITER_JOINED', 'Rita', at(5, 11)),
            entry('RECRUITER_JOINED', 'Sara', at(5, 21)),
          ],
        },
        assignments: { r1: [assignment('a1', at(5, 15)), assignment('a2', at(6, 21))] },
      },
      WEEK,
    )
    expect(byName.get('Rita')).toEqual({
      attentionHours: [2],
      perPersonDays: [4 / 24, 34 / 24],
    })
    // Sara llegó después de la primera persona: solo cuenta la segunda.
    expect(byName.get('Sara')).toEqual({ attentionHours: [12], perPersonDays: [1] })
  })
})
