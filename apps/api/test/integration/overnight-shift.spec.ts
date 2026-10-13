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
 * Un turno que cruza medianoche queda partido en dos días calendario —uno
 * con entrada sin salida, el siguiente con salida sin entrada— porque cada
 * marca se guarda por SU PROPIA fecha (`workDate` en `openDay`), sin ningún
 * concepto de turno. Hugo, 2026-10-12: "que pasa cuando trabaja más de las
 * 12 del día siguiente". El servicio los empareja solo cuando el hueco es
 * creíble (<=16h) y reparte las horas a cada lado de la medianoche; si de
 * verdad se le olvidó ponchar, se queda como anomalía real.
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

/** Igual que `correct-punch.spec.ts`: `manualPunch` crea el timesheet/día
 * por su cuenta, así que se resuelven aquí para que `cleanup` los borre. */
async function trackDay(dayId: string): Promise<void> {
  const day = await db.timesheetDay.findUniqueOrThrow({
    where: { id: dayId },
    select: { timesheetId: true },
  })
  if (!reg.rows.some((row) => row.table === 'operations.timesheet' && row.id === day.timesheetId)) {
    reg.rows.push({ table: 'operations.timesheet', id: day.timesheetId })
  }
  reg.rows.push({ table: 'operations.timesheet_day', id: dayId })
}

/** La marca se registra DESPUÉS de su día en `reg.rows` para que `cleanup`
 * (que borra en reversa) la quite primero — si no, `timesheet_day` queda con
 * una marca todavía colgando y la FK truena. */
function trackPunch(punchId: string): void {
  reg.rows.push({ table: 'operations.punch_mark', id: punchId })
}

async function setup(label: string): Promise<{ assignmentId: string }> {
  const base = await lookups()
  const hotelId = await makeHotel(reg, { label, zoneId: base.zoneId, timeZone: 'America/New_York' })
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
    label,
  })
  workers.push(workerId)
  const assignmentId = await makeAssignment({ requisitionId, workerId, startDate: '2025-06-02' })
  await makeSchedule(reg, { hotelId, weekStart: '2025-06-02', weekEnd: '2025-06-08', actorId })

  return { assignmentId }
}

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

describe('turno que cruza medianoche', () => {
  it('entrada 10pm + salida 6am del día siguiente se emparejan solas, sin anomalía', async () => {
    const { assignmentId } = await setup('Nocturno')

    const entrada = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date('2025-06-02'),
        occurredAt: new Date('2025-06-02T22:00:00Z'),
        reason: 'Siembra de prueba',
      },
      supervisor(),
    )
    await trackDay(entrada.dayId)
    trackPunch(entrada.punch.id)

    const salida = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_OUT',
        workDate: new Date('2025-06-03'),
        occurredAt: new Date('2025-06-03T06:00:00Z'),
        reason: 'Siembra de prueba',
      },
      supervisor(),
    )
    await trackDay(salida.dayId)
    trackPunch(salida.punch.id)

    // La respuesta de la marca que cierra el turno ya trae el lado propio
    // emparejado: 6h (medianoche a las 6am), sin anomalía.
    expect(salida.hasAnomaly).toBe(false)
    expect(salida.grossMinutes).toBe(6 * 60)

    const days = await db.timesheetDay.findMany({
      where: { id: { in: [entrada.dayId, salida.dayId] } },
      orderBy: { workDate: 'asc' },
    })

    expect(days).toHaveLength(2)
    const [day1, day2] = days as [(typeof days)[number], (typeof days)[number]]

    expect(day1.hasAnomaly).toBe(false)
    expect(day1.grossMinutes).toBe(2 * 60) // 10pm a medianoche
    expect(day1.continuesNextDay).toBe(true)
    expect(day1.continuesFromPreviousDay).toBe(false)

    expect(day2.hasAnomaly).toBe(false)
    expect(day2.grossMinutes).toBe(6 * 60) // medianoche a las 6am
    expect(day2.continuesFromPreviousDay).toBe(true)
    expect(day2.continuesNextDay).toBe(false)
  })

  it('si de verdad se le olvidó ponchar, el día siguiente NO lo empareja (no hay salida huérfana)', async () => {
    const { assignmentId } = await setup('Olvido')

    // Lunes: entra, nunca poncha salida.
    const lunes = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date('2025-06-02'),
        occurredAt: new Date('2025-06-02T12:00:00Z'),
        reason: 'Siembra de prueba',
      },
      supervisor(),
    )
    await trackDay(lunes.dayId)
    trackPunch(lunes.punch.id)

    // Martes: entra normal para su turno de siempre — esto NO es una salida
    // huérfana, es una entrada nueva, así que no debe emparejar con el lunes.
    const martes = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date('2025-06-03'),
        occurredAt: new Date('2025-06-03T12:00:00Z'),
        reason: 'Siembra de prueba',
      },
      supervisor(),
    )
    await trackDay(martes.dayId)
    trackPunch(martes.punch.id)

    const lunesDay = await db.timesheetDay.findUniqueOrThrow({ where: { id: lunes.dayId } })
    expect(lunesDay.hasAnomaly).toBe(true)
    expect(lunesDay.continuesNextDay).toBe(false)
    expect(lunesDay.grossMinutes).toBe(0)
  })

  it('un hueco de más de 16h no se considera un turno creíble: se queda como anomalía', async () => {
    const { assignmentId } = await setup('Hueco largo')

    const entrada = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_IN',
        workDate: new Date('2025-06-02'),
        occurredAt: new Date('2025-06-02T08:00:00Z'),
        reason: 'Siembra de prueba',
      },
      supervisor(),
    )
    await trackDay(entrada.dayId)
    trackPunch(entrada.punch.id)

    // 20h después, al otro día — más que un turno real.
    const salida = await timesheets.manualPunch(
      {
        assignmentId,
        type: 'CLOCK_OUT',
        workDate: new Date('2025-06-03'),
        occurredAt: new Date('2025-06-03T04:00:00Z'),
        reason: 'Siembra de prueba',
      },
      supervisor(),
    )
    await trackDay(salida.dayId)
    trackPunch(salida.punch.id)

    expect(salida.hasAnomaly).toBe(true)

    const entradaDay = await db.timesheetDay.findUniqueOrThrow({ where: { id: entrada.dayId } })
    expect(entradaDay.hasAnomaly).toBe(true)
    expect(entradaDay.continuesNextDay).toBe(false)
  })
})
