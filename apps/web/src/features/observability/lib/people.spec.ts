import { describe, expect, it } from 'vitest'

import { inspectionPeople, recruitmentPeople, salesPeople } from './people'
import { periodOf } from './period'

import type { ProspectApi, RequisitionApi, WorkerApi } from '@/shared/types/apiContract.types'

const NOW = new Date(2026, 9, 7, 15, 0, 0)
const WEEK = periodOf('week', NOW)
const at = (day: number, hour = 9): string => new Date(2026, 9, day, hour).toISOString()

const metric = (
  row: { metrics: Array<{ label: { message?: string }; value: number }> },
  name: string,
): number | undefined => row.metrics.find((item) => item.label.message === name)?.value

describe('Ventas por persona', () => {
  const prospects = [
    {
      id: 'p1',
      owner: { id: 'ana', fullName: 'Ana' },
      hotel: { name: 'Hotel A' },
      isOpen: true,
      openedAt: at(1),
      lastAttempt: null,
      state: { code: 'GREEN' },
      stateSince: at(1),
    },
    {
      id: 'p2',
      owner: { id: 'ana', fullName: 'Ana' },
      hotel: { name: 'Hotel B' },
      isOpen: false,
      openedAt: at(1),
      lastAttempt: null,
      state: { code: 'ORANGE' },
      stateSince: at(6),
    },
    {
      id: 'p3',
      owner: { id: 'beto', fullName: 'Beto' },
      hotel: { name: 'Hotel C' },
      isOpen: true,
      openedAt: new Date(2026, 8, 20).toISOString(),
      lastAttempt: null,
      state: { code: 'GRAY' },
      stateSince: at(1),
    },
  ] as unknown as ProspectApi[]

  it('cartera al dueño, intentos a quien los registra, el inactivo primero', () => {
    const rows = salesPeople({
      period: WEEK,
      prospects,
      attempts: [
        {
          prospectId: 'p1',
          user: { id: 'ana', fullName: 'Ana' },
          attemptType: 'CALL',
          outcome: 'MEETING_SET',
          occurredAt: at(6),
        },
        {
          prospectId: 'p1',
          user: { id: 'ana', fullName: 'Ana' },
          attemptType: 'CALL',
          outcome: 'NO_ANSWER',
          occurredAt: at(2),
        },
      ] as never,
    })
    expect(rows.map((row) => row.name)).toEqual(['Beto', 'Ana'])
    const [beto, ana] = rows
    expect(beto?.lastActivityAt).toBeNull()
    expect(beto && metric(beto, 'Estancados')).toBe(1)
    expect(ana && metric(ana, 'Intentos')).toBe(1)
    expect(ana && metric(ana, 'Citas')).toBe(1)
    expect(ana && metric(ana, 'Conversiones')).toBe(1)
    expect(ana?.events.find((event) => event.kind === 'CALL')).toMatchObject({
      kind: 'CALL',
      subject: 'Hotel A',
      outcome: 'MEETING_SET',
    })
  })
})

describe('Reclutamiento por persona', () => {
  const requisition = {
    id: 'r1',
    number: 'R-1',
    hotel: { name: 'H' },
    state: { code: 'YELLOW' },
    totalSlots: 5,
    filledSlots: 2,
  } as RequisitionApi

  it('la tiene a su cargo quien la tomó y no la soltó', () => {
    const rows = recruitmentPeople({
      period: WEEK,
      requisitions: [requisition],
      journals: {
        r1: [
          {
            id: '1',
            eventType: 'RECRUITER_JOINED',
            actorName: 'Rita',
            actorRole: 'ROL-R-01',
            payload: null,
            occurredAt: at(5),
          },
          {
            id: '2',
            eventType: 'RECRUITER_JOINED',
            actorName: 'Sara',
            actorRole: 'ROL-R-01',
            payload: null,
            occurredAt: at(5, 10),
          },
          {
            id: '3',
            eventType: 'RECRUITER_LEFT',
            actorName: 'Sara',
            actorRole: 'ROL-R-01',
            payload: null,
            occurredAt: at(6),
          },
          {
            id: '4',
            eventType: 'REQUISITION_CREATED',
            actorName: 'Gerente',
            actorRole: 'ROL-H-03',
            payload: null,
            occurredAt: at(4),
          },
        ],
      },
    })
    const rita = rows.find((row) => row.name === 'Rita')
    const sara = rows.find((row) => row.name === 'Sara')
    expect(rows).toHaveLength(2)
    expect(rita && metric(rita, 'Requisiciones a su cargo')).toBe(1)
    expect(rita && metric(rita, 'Lugares por cubrir en las suyas')).toBe(3)
    expect(sara && metric(sara, 'Requisiciones a su cargo')).toBe(0)
    expect(sara && metric(sara, 'Soltadas')).toBe(1)
  })

  it('cuenta los candidatos que dio de alta cada reclutadora', () => {
    const workers = [
      { id: 'w1', fullName: 'Luis Pérez', createdAt: at(5) },
      { id: 'w2', fullName: 'Eva Ruiz', createdAt: at(6) },
      { id: 'w3', fullName: 'Viejo', createdAt: at(1) },
    ] as WorkerApi[]
    const signup = (id: string, userName: string, day: number) => [
      {
        id: `${id}-b`,
        fromState: 'PENDING_VALIDATION',
        toState: 'GREEN',
        reason: null,
        occurredAt: at(day + 1),
        userName: 'Otra',
      },
      {
        id,
        fromState: null,
        toState: 'PENDING_VALIDATION',
        reason: null,
        occurredAt: at(day),
        userName,
      },
    ]
    const rows = recruitmentPeople({
      period: WEEK,
      requisitions: [requisition],
      journals: {
        r1: [
          {
            id: '1',
            eventType: 'RECRUITER_JOINED',
            actorName: 'Rita',
            actorRole: 'ROL-R-01',
            payload: null,
            occurredAt: at(5),
          },
        ],
      },
      workers,
      histories: {
        w1: signup('h1', 'Rita', 5),
        w2: signup('h2', 'Nora', 6),
        w3: signup('h3', 'Rita', 1),
      },
    })

    const rita = rows.find((row) => row.name === 'Rita')
    const nora = rows.find((row) => row.name === 'Nora')
    expect(rows).toHaveLength(2)
    // Rita: la de la bitácora, con su alta de la semana (la del día 1 queda fuera).
    expect(rita && metric(rita, 'Candidatos dados de alta')).toBe(1)
    expect(rita && metric(rita, 'Requisiciones a su cargo')).toBe(1)
    expect(rita?.events.find((event) => event.kind === 'WORKER_CREATED')?.subject).toBe(
      'Luis Pérez',
    )
    // Nora no movió requisiciones: aparece solo por su alta.
    expect(nora && metric(nora, 'Candidatos dados de alta')).toBe(1)
    expect(nora?.roleCode).toBeNull()
  })
})

describe('Inspección por persona', () => {
  it('requisiciones de su zona y las que creó', () => {
    const inspector = { id: 'i1', fullName: 'Iván', photoUrl: null }
    const rows = inspectionPeople({
      period: WEEK,
      requisitions: [
        {
          id: 'a',
          number: 'R-1',
          hotel: { name: 'H' },
          state: { code: 'GREEN' },
          inspector,
          createdBy: inspector,
          createdAt: at(6),
          positions: [
            { startDate: '2026-10-06', urgency: { code: 'RED' }, filled: 0, quantity: 2 },
          ],
        },
        {
          id: 'b',
          number: 'R-2',
          hotel: { name: 'H' },
          state: { code: 'LIGHT_BLUE' },
          inspector,
          createdBy: null,
          createdAt: at(1),
          positions: [{ startDate: '2026-10-01', urgency: null, filled: 1, quantity: 1 }],
        },
      ] as unknown as RequisitionApi[],
    })
    expect(rows).toHaveLength(1)
    const [ivan] = rows
    expect(ivan && metric(ivan, 'Requisiciones abiertas en su zona')).toBe(1)
    expect(ivan && metric(ivan, 'Posiciones urgentes sin cubrir')).toBe(1)
    expect(ivan && metric(ivan, 'Requisiciones que creó')).toBe(1)
    expect(ivan && metric(ivan, 'Arrancan en el periodo')).toBe(1)
  })
})
