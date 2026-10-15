import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
  lookups,
  makeHotel,
  makeRequisition,
  makeSchedule,
  makeTimesheet,
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * Sin Schedule (beta "Ponche por Horario" apagada), un día sin ponches no
 * deja fila: con qué se marca antes de enviar a aprobación, y por qué sin
 * marcarlo "Enviar y aprobar" se rechaza (Hugo, 2026-10-12).
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

const reg: Registry = { rows: [] }
const workers: string[] = []
let actorId: string
let restId: string

function supervisor(hotelId: string | null = null): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-H-01', hotelId, departmentId: null }
}

beforeAll(async () => {
  actorId = (await actor()).id
  restId = (await db.timesheetDayStatus.findFirstOrThrow({ where: { code: 'REST' } })).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

const WEEK = [
  '2025-07-07',
  '2025-07-08',
  '2025-07-09',
  '2025-07-10',
  '2025-07-11',
  '2025-07-12',
  '2025-07-13',
]

/** Un slot ocupado por una asignación FIJA — mismo patrón que `correct-punch.spec.ts`. */
async function makeAssignment(params: {
  requisitionId: string
  workerId: string
  startDate: string
}): Promise<string> {
  const position = await db.position.findFirstOrThrow({
    where: { requisitionId: params.requisitionId },
    select: { id: true },
  })

  const slotId = uuidv7()
  await db.slot.create({
    data: { id: slotId, positionId: position.id, ordinal: 1, status: 'taken' },
  })
  reg.rows.push({ table: 'demand.slot', id: slotId })

  const assignmentId = uuidv7()
  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (
      ${assignmentId}::uuid, ${slotId}::uuid, ${params.workerId}::uuid, 'FIXED',
      daterange(${params.startDate}::date, NULL, '[)'), 'ACTIVE', ${actorId}::uuid
    )`
  reg.rows.push({ table: 'coverage.assignment', id: assignmentId })

  return assignmentId
}

async function setUp(
  label: string,
  days: number,
): Promise<{ timesheetId: string; requisitionId: string; workerId: string }> {
  const base = await lookups()
  const hotelId = await makeHotel(reg, { label, zoneId: base.zoneId, timeZone: 'America/New_York' })
  const requisitionId = await makeRequisition(reg, {
    hotelId,
    positionId: base.positionId,
    modalityId: base.modalityId,
    departmentId: base.departmentId,
    coverageStateId: base.coverageStateId,
    reqStateId: base.reqStateId,
    startDate: WEEK[0] as string,
  })
  const workerId = await makeWorker(reg, {
    zoneId: base.zoneId,
    workerStateId: base.workerStateId,
    actorId,
    label,
  })
  workers.push(workerId)
  const scheduleId = await makeSchedule(reg, {
    hotelId,
    weekStart: WEEK[0] as string,
    weekEnd: WEEK[6] as string,
    actorId,
  })
  const timesheetId = await makeTimesheet(reg, {
    scheduleId,
    workerId,
    requisitionId,
    weekStart: WEEK[0] as string,
    weekEnd: WEEK[6] as string,
    status: 'OPEN',
    actorId,
    days,
  })

  return { timesheetId, requisitionId, workerId }
}

describe('marcar un día sin ponches antes de aprobar', () => {
  it('enviar rechaza una semana con días sin marca ni estado', async () => {
    const { timesheetId } = await setUp('Sin marcar', 1)

    await expect(timesheets.submit(timesheetId, supervisor())).rejects.toMatchObject({
      response: {
        code: 'DAYS_WITHOUT_STATUS',
        details: WEEK.slice(1).map((value) => ({ field: 'workDate', value })),
      },
    })
  })

  it('marcar los días que faltan como Descanso desbloquea enviar', async () => {
    const { timesheetId } = await setUp('Completa', 1)

    for (const workDate of WEEK.slice(1)) {
      const day = await timesheets.setDayStatus(
        timesheetId,
        new Date(`${workDate}T00:00:00Z`),
        restId,
        supervisor(),
        true,
      )
      reg.rows.push({ table: 'operations.timesheet_day', id: day.id })
      expect(day.dayStatus).toEqual({ code: 'REST', name: 'Descanso' })
    }

    const result = await timesheets.submit(timesheetId, supervisor())
    expect(result.status).toBe('PENDING_APPROVAL')
  })

  it('un día con ponches no se puede marcar como descanso', async () => {
    const { timesheetId, requisitionId, workerId } = await setUp('Con ponches', 0)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      startDate: WEEK[0] as string,
    })

    const { punch, dayId } = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date(`${WEEK[0]}T00:00:00Z`),
        occurredAt: new Date(`${WEEK[0]}T08:00:00Z`),
        reason: 'El lector del hotel no funcionaba',
      },
      supervisor(),
    )
    reg.rows.push({ table: 'operations.timesheet_day', id: dayId })
    reg.rows.push({ table: 'operations.punch_mark', id: punch.id })

    await expect(
      timesheets.setDayStatus(
        timesheetId,
        new Date(`${WEEK[0]}T00:00:00Z`),
        restId,
        supervisor(),
        true,
      ),
    ).rejects.toMatchObject({ response: { code: 'DAY_HAS_PUNCHES' } })
  })

  it('quitar el estado (null) regresa el día a sin marcar', async () => {
    const { timesheetId } = await setUp('Quitar', 1)

    const created = await timesheets.setDayStatus(
      timesheetId,
      new Date(`${WEEK[1]}T00:00:00Z`),
      restId,
      supervisor(),
      true,
    )
    reg.rows.push({ table: 'operations.timesheet_day', id: created.id })
    const cleared = await timesheets.setDayStatus(
      timesheetId,
      new Date(`${WEEK[1]}T00:00:00Z`),
      null,
      supervisor(),
      true,
    )
    expect(cleared.dayStatus).toBeNull()
  })

  it('la semana completa trae los 7 días aunque falten ponches', async () => {
    const { timesheetId } = await setUp('Siete dias', 1)

    const sheet = await timesheets.getScoped(timesheetId, supervisor(), true)
    const days = sheet.days ?? []
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.workDate)).toEqual(WEEK)
    expect(days[1]?.id.startsWith('virtual:')).toBe(true)
  })
})
