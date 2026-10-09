import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * La progresión del Semáforo del Colaborador, que dispara el ponche.
 *
 * El vault la describe desde siempre —día 1 a Verde manzana, día 3 a Azul
 * claro, 7 días a Naranja— y las tres transiciones están sembradas a nombre
 * del Sistema, pero hasta hoy no las disparaba nadie: el semáforo solo se
 * movía a mano (Hugo, 2026-10-09).
 */
const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

let user: AuthenticatedUser
let zoneId: string

const workerIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []
const timesheetIds: string[] = []

/** Un día trabajado: una marca manual, que es asistencia igual que el ponche. */
async function trabajaEl(assignmentId: string, díasAtrás: number): Promise<void> {
  /* Mediodía UTC y no medianoche: el hotel está en Cancún (UTC-5) y la
     medianoche UTC cae el día ANTERIOR allá, así que la semana que abre el
     Schedule no coincidiría con la que se vuelve a leer. */
  const día = new Date()
  día.setUTCDate(día.getUTCDate() - díasAtrás)
  día.setUTCHours(12, 0, 0, 0)
  const entrada = new Date(día)
  entrada.setUTCHours(14, 0, 0, 0)

  await timesheets.manualPunch(
    {
      assignmentId,
      workDate: día,
      type: 'CLOCK_IN',
      occurredAt: entrada,
      reason: 'Alta de prueba de progresión',
    } as never,
    user,
  )
}

async function color(workerId: string): Promise<string> {
  const w = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    select: { statusState: { select: { code: true } } },
  })
  return w.statusState.code
}

/** Colaborador validado (Verde fuerte) con una asignación fija viva. */
async function asignado(etiqueta: string): Promise<{ workerId: string; assignmentId: string }> {
  const verde = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: etiqueta,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: verde.id,
      statusLightCode: 'WORKER',
      createdBy: user.id,
    },
    select: { id: true },
  })
  workerIds.push(worker.id)

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel progresión ${etiqueta}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: user.id,
      updatedBy: user.id,
    },
    select: { id: true },
  })
  hotelIds.push(hotel.id)

  const enProceso = await db.statusLightState.findFirstOrThrow({
    where: { code: 'YELLOW', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })
  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `PR${Date.now()}${String(Math.floor(Math.random() * 1000))}`,
      hotelId: hotel.id,
      statusLightStateId: enProceso.id,
      statusLightCode: 'REQUISITION',
      createdBy: user.id,
    },
    select: { id: true },
  })
  requisitionIds.push(requisition.id)

  const position = await db.position.create({
    data: {
      id: uuidv7(),
      requisitionId: requisition.id,
      lineNumber: 1,
      catalogPositionId: (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id,
      hiringModalityId: (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id,
      hotelDepartmentId: (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id,
      quantity: 1,
      startDate: new Date(),
      startTime: new Date('1970-01-01T07:00:00Z'),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })
  const slot = await db.slot.create({
    data: { id: uuidv7(), positionId: position.id, ordinal: 1, status: 'taken' },
    select: { id: true },
  })
  const assignmentId = uuidv7()
  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${assignmentId}::uuid, ${slot.id}::uuid, ${worker.id}::uuid, 'FIXED',
            daterange(current_date - 20, NULL), 'ACTIVE', ${user.id}::uuid)`

  return { workerId: worker.id, assignmentId }
}

beforeAll(async () => {
  const { id } = await actor()
  const role = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true } })
  user = { id, roleCode: role.role.code, hotelId: null, departmentId: null }
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  const pasos: Array<() => Promise<unknown>> = [
    () =>
      db.punchMark.deleteMany({ where: { timesheetDay: { timesheetId: { in: timesheetIds } } } }),
    () => db.timesheetDay.deleteMany({ where: { timesheetId: { in: timesheetIds } } }),
    () => db.timesheet.deleteMany({ where: { workerId: { in: workerIds } } }),
    () => db.assignment.deleteMany({ where: { workerId: { in: workerIds } } }),
    () => db.workerStateHistory.deleteMany({ where: { workerId: { in: workerIds } } }),
    () =>
      db.requisitionStateHistory.deleteMany({ where: { requisitionId: { in: requisitionIds } } }),
    () => db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitionIds } } } }),
    () => db.position.deleteMany({ where: { requisitionId: { in: requisitionIds } } }),
    () => db.requisition.deleteMany({ where: { id: { in: requisitionIds } } }),
    () => db.hotel.deleteMany({ where: { id: { in: hotelIds } } }),
    () => db.worker.deleteMany({ where: { id: { in: workerIds } } }),
  ]
  for (const paso of pasos) {
    try {
      await paso()
    } catch {
      /* La limpieza no puede dejar basura porque un paso falle. */
    }
  }
  await close()
})

test('día 1 lo pasa a Verde manzana, y ponchar otra vez el mismo día no lo mueve', async () => {
  const { workerId, assignmentId } = await asignado(`Dia1 ${String(Date.now())}`)
  expect(await color(workerId)).toBe('STRONG_GREEN')

  await trabajaEl(assignmentId, 9)
  expect(await color(workerId)).toBe('APPLE_GREEN')

  // Idempotente: el mismo día no cuenta dos veces.
  await timesheets
    .manualPunch(
      {
        assignmentId,
        workDate: (() => {
          const d = new Date()
          d.setUTCDate(d.getUTCDate() - 9)
          d.setUTCHours(12, 0, 0, 0)
          return d
        })(),
        type: 'CLOCK_OUT',
        occurredAt: new Date(),
        reason: 'Salida de prueba',
      } as never,
      user,
    )
    .catch(() => undefined)
  expect(await color(workerId)).toBe('APPLE_GREEN')
})

test('al tercer día pasa a Azul claro y al séptimo a Naranja, un escalón por ponche', async () => {
  const { workerId, assignmentId } = await asignado(`Escalera ${String(Date.now())}`)

  for (const días of [9, 8, 7]) await trabajaEl(assignmentId, días)
  expect(await color(workerId)).toBe('LIGHT_BLUE')

  for (const días of [6, 5, 4, 3]) await trabajaEl(assignmentId, días)
  expect(await color(workerId)).toBe('ORANGE')

  const historia = await db.workerStateHistory.findMany({
    where: { workerId },
    orderBy: { occurredAt: 'asc' },
    select: { toState: { select: { code: true } }, userId: true },
  })
  expect(historia.map((h) => h.toState.code)).toEqual(['APPLE_GREEN', 'LIGHT_BLUE', 'ORANGE'])
  // Sin persona detrás: lo movió el sistema al contar los días.
  expect(historia.every((h) => h.userId === null)).toBe(true)
})

test('en Café no avanza: el temporal tiene su propio ciclo', async () => {
  const { workerId, assignmentId } = await asignado(`Cafe ${String(Date.now())}`)
  const café = await db.statusLightState.findFirstOrThrow({
    where: { code: 'BROWN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  await db.worker.update({ where: { id: workerId }, data: { statusLightStateId: café.id } })

  await trabajaEl(assignmentId, 9)

  expect(await color(workerId)).toBe('BROWN')
})
