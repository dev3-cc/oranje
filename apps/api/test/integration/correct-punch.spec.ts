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
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * Corregir una marca YA registrada (Hugo, 2026-10-10): `timesheet:correct_punch`
 * estaba sembrado desde el 2026-09-29 sin un solo endpoint — es del Manager de
 * Área/General, con el mismo alcance por departamento que ya usa `approve`.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

const reg: Registry = { rows: [] }
const workers: string[] = []
let actorId: string

function supervisor(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-H-01', hotelId: null, departmentId: null }
}

function areaManager(departmentId: string | null): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-H-02', hotelId: null, departmentId }
}

/** Un slot ocupado por una asignación FIJA — mismo patrón que
 * `assignment-pay-adjustment.spec.ts`. */
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

/** `manualPunch` crea el timesheet/día por su cuenta (find-or-create, D-21);
 * ninguno de los dos vuelve en su respuesta más allá del `dayId`, así que se
 * resuelven aquí para que `cleanup` también los borre, en orden: el día
 * antes que su timesheet, y los dos antes que el `schedule` ya en `reg.rows`. */
async function trackDay(dayId: string): Promise<void> {
  const day = await db.timesheetDay.findUniqueOrThrow({
    where: { id: dayId },
    select: { timesheetId: true },
  })
  // cleanup borra en reversa: el timesheet (padre) va primero en el arreglo
  // para que el día (hijo, con la FK) se borre antes que él.
  reg.rows.push({ table: 'operations.timesheet', id: day.timesheetId })
  reg.rows.push({ table: 'operations.timesheet_day', id: dayId })
}

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

describe('corregir un ponche ya registrado', () => {
  it('el Manager de Área de ese departamento corrige la hora, y queda en el journal', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'Corregir',
      zoneId: base.zoneId,
      timeZone: 'America/New_York',
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: '2025-06-02',
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'Corregir',
    })
    workers.push(workerId)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      startDate: '2025-06-02',
    })
    await makeSchedule(reg, {
      hotelId,
      weekStart: '2025-06-02',
      weekEnd: '2025-06-08',
      actorId,
    })

    // Capturada de más por el Supervisor — una hora equivocada, de ahí la corrección.
    const { punch, dayId } = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date('2025-06-02'),
        occurredAt: new Date('2025-06-02T08:00:00Z'),
        reason: 'El lector del hotel no funcionaba',
      },
      supervisor(),
    )
    await trackDay(dayId)
    reg.rows.push({ table: 'operations.punch_mark', id: punch.id })

    const result = await timesheets.correctPunch(
      punch.id,
      { occurredAt: new Date('2025-06-02T07:30:00Z'), reason: 'La hora real era 7:30, no 8:00' },
      areaManager(base.departmentId),
    )

    expect(result.punch.serverAt).toBe('2025-06-02T07:30:00.000Z')

    const journalEntry = await db.journalEntry.findFirst({
      where: {
        entityType: 'operations.punch_mark',
        entityId: punch.id,
        eventType: 'PUNCH_CORRECTED',
      },
    })
    expect(journalEntry).not.toBeNull()
    expect(journalEntry?.payload).toMatchObject({
      previousOccurredAt: '2025-06-02T08:00:00.000Z',
      occurredAt: '2025-06-02T07:30:00.000Z',
      reason: 'La hora real era 7:30, no 8:00',
    })
  })

  it('un Manager de Área de OTRO departamento no puede corregir', async () => {
    const base = await lookups()
    const otherDepartment = await db.hotelDepartment.findFirstOrThrow({
      where: { id: { not: base.departmentId } },
      select: { id: true },
    })
    const hotelId = await makeHotel(reg, {
      label: 'Corregir ajeno',
      zoneId: base.zoneId,
      timeZone: 'America/New_York',
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: '2025-06-02',
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'Corregir ajeno',
    })
    workers.push(workerId)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      startDate: '2025-06-02',
    })
    await makeSchedule(reg, {
      hotelId,
      weekStart: '2025-06-02',
      weekEnd: '2025-06-08',
      actorId,
    })

    const { punch, dayId } = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date('2025-06-02'),
        occurredAt: new Date('2025-06-02T08:00:00Z'),
        reason: 'El lector del hotel no funcionaba',
      },
      supervisor(),
    )
    await trackDay(dayId)
    reg.rows.push({ table: 'operations.punch_mark', id: punch.id })

    await expect(
      timesheets.correctPunch(
        punch.id,
        { occurredAt: new Date('2025-06-02T07:30:00Z'), reason: 'No debería poder' },
        areaManager(otherDepartment.id),
      ),
    ).rejects.toMatchObject({ response: { code: 'DEPARTMENT_OUT_OF_SCOPE' } })
  })
})
