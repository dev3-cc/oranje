import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ObservabilityRepository } from '../../src/modules/observability/observability.repository.js'
import { PendingApprovalsRepository } from '../../src/modules/settlement/pending-approvals/pending-approvals.repository.js'
import { PendingApprovalsService } from '../../src/modules/settlement/pending-approvals/pending-approvals.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
  lookups,
  makeHotel,
  makeRequisition,
  makeSchedule,
  makeTimesheet,
  type Registry,
} from './payment-fixture.js'

/**
 * Observabilidad tiene que contar «semanas de timesheet sin aprobar» igual que
 * la lista de Contabilidad: pendientes (OPEN o PENDING_APPROVAL) de semanas ya
 * cerradas, un renglón por hotel y semana. Antes contaba solo PENDING_APPROVAL
 * y no miraba el cierre.
 */

const prisma = db as unknown as PrismaService
const repo = new ObservabilityRepository(prisma)
const list = new PendingApprovalsService(new PendingApprovalsRepository(prisma))

const DAY_MS = 86_400_000

/** AAAA-MM-DD de una fecha, en UTC. */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * El lunes de la PRÓXIMA semana: nunca cerrada todavía, sin importar qué día
 * sea hoy cuando corra la prueba — un literal fijo (`2026-10-05`) se quedaba
 * viejo en cuanto pasaba esa fecha y la semana "en curso" de ayer pasaba a
 * estar cerrada hoy (la misma lección de fijar el reloj, no la fecha).
 */
function nextMonday(): Date {
  const today = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  )
  const daysUntilNextMonday = ((8 - today.getUTCDay()) % 7) + 7
  return new Date(today.getTime() + daysUntilNextMonday * DAY_MS)
}

const CLOSED_WEEK = '2025-03-03' // lunes; cerró el domingo 9 de marzo de 2025
const OPEN_WEEK_DATE = nextMonday()
const OPEN_WEEK = iso(OPEN_WEEK_DATE) // lunes de una semana futura: no cerrada todavía
const OPEN_WEEK_END = iso(new Date(OPEN_WEEK_DATE.getTime() + 6 * DAY_MS))
const reg: Registry = { rows: [] }
const workers: string[] = []

describe('observabilidad cuenta lo que cuenta la lista de Contabilidad', () => {
  let actorId: string
  let hotelId: string
  let before: number

  beforeAll(async () => {
    actorId = (await actor()).id
    const base = await lookups()
    before = await repo.hotelPendingApprovalWeeks()

    hotelId = await makeHotel(reg, {
      label: 'Observa',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    const reqA = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: CLOSED_WEEK,
    })
    const reqB = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: CLOSED_WEEK,
    })
    const reqOpen = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: OPEN_WEEK,
    })
    const reqApproved = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: CLOSED_WEEK,
    })

    const workerRows = await db.worker.findMany({
      where: { deletedAt: null },
      select: { id: true },
      take: 4,
    })
    const [w1, w2, w3, w4] = workerRows.map((w) => w.id)
    if (!w1 || !w2 || !w3 || !w4)
      throw new Error('Se necesitan al menos cuatro colaboradores en la base de pruebas')

    const schedClosed = await makeSchedule(reg, {
      hotelId,
      weekStart: CLOSED_WEEK,
      weekEnd: '2025-03-09',
      actorId,
    })
    const schedOpen = await makeSchedule(reg, {
      hotelId,
      weekStart: OPEN_WEEK,
      weekEnd: OPEN_WEEK_END,
      actorId,
    })

    // Semana cerrada: una OPEN y una PENDING_APPROVAL → UN renglón (hotel + semana).
    await makeTimesheet(reg, {
      scheduleId: schedClosed,
      workerId: w1,
      requisitionId: reqA,
      weekStart: CLOSED_WEEK,
      weekEnd: '2025-03-09',
      status: 'OPEN',
      actorId,
    })
    await makeTimesheet(reg, {
      scheduleId: schedClosed,
      workerId: w2,
      requisitionId: reqB,
      weekStart: CLOSED_WEEK,
      weekEnd: '2025-03-09',
      status: 'PENDING_APPROVAL',
      actorId,
    })
    // Aprobada: no cuenta.
    await makeTimesheet(reg, {
      scheduleId: schedClosed,
      workerId: w3,
      requisitionId: reqApproved,
      weekStart: CLOSED_WEEK,
      weekEnd: '2025-03-09',
      status: 'APPROVED',
      approvedAt: new Date('2025-03-10T12:00:00Z'),
      actorId,
    })
    // Semana en curso: todavía no está atrasada, no cuenta.
    await makeTimesheet(reg, {
      scheduleId: schedOpen,
      workerId: w4,
      requisitionId: reqOpen,
      weekStart: OPEN_WEEK,
      weekEnd: OPEN_WEEK_END,
      status: 'OPEN',
      actorId,
    })
  })

  afterAll(async () => {
    await cleanup(reg, workers)
    await close()
  })

  it('una semana cerrada con horas sin aprobar cuenta una vez, aunque tenga dos hojas OPEN y PENDING_APPROVAL', async () => {
    expect((await repo.hotelPendingApprovalWeeks()) - before).toBe(1)
  })

  it('el conteo de Observabilidad coincide con el largo de la lista de Contabilidad', async () => {
    const weeks = await list.list({})

    expect(await repo.hotelPendingApprovalWeeks()).toBe(weeks.length)
  })
})
