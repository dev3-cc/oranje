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
const scheduleIds: string[] = []
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
    () => db.scheduleEntry.deleteMany({ where: { scheduleId: { in: scheduleIds } } }),
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
    () => db.schedule.deleteMany({ where: { id: { in: scheduleIds } } }),
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

/** Un turno planeado para un día que ya pasó, sin ningún ponche. */
async function turnoSinPonchar(assignmentId: string, díasAtrás: number): Promise<void> {
  const fila = await db.$queryRaw<Array<{ hotelId: string }>>`
    SELECT r.hotel_id::text AS "hotelId"
      FROM coverage.assignment a
      JOIN demand.slot s ON s.id = a.slot_id
      JOIN demand.position p ON p.id = s.position_id
      JOIN demand.requisition r ON r.id = p.requisition_id
     WHERE a.id = ${assignmentId}::uuid`
  const hotelId = fila[0]?.hotelId
  if (hotelId === undefined) throw new Error('sin hotel')

  const día = new Date()
  día.setUTCDate(día.getUTCDate() - díasAtrás)
  día.setUTCHours(12, 0, 0, 0)
  const fecha = día.toISOString().slice(0, 10)

  const sc = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO operations.schedule (id, hotel_id, week_start, week_end, created_by)
    VALUES (${uuidv7()}::uuid, ${hotelId}::uuid,
            date_trunc('week', ${fecha}::date)::date,
            date_trunc('week', ${fecha}::date)::date + 6, ${user.id}::uuid)
    ON CONFLICT (hotel_id, week_start) DO UPDATE SET updated_at = now()
    RETURNING id::text`
  const scheduleId = sc[0]?.id
  if (scheduleId === undefined) throw new Error('sin schedule')
  scheduleIds.push(scheduleId)

  const trabajador = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { workerId: true },
  })
  await db.$executeRaw`
    INSERT INTO operations.schedule_entry (id, schedule_id, assignment_id, worker_id, work_date, shift_range)
    VALUES (${uuidv7()}::uuid, ${scheduleId}::uuid, ${assignmentId}::uuid,
            ${trabajador.workerId}::uuid, ${fecha}::date,
            tstzrange(${fecha}::date + time '07:00', ${fecha}::date + time '15:00'))`
}

test('un turno de un día cerrado sin ponche es una inasistencia, y lo pasa a Morado', async () => {
  const { workerId, assignmentId } = await asignado(`Falta ${String(Date.now())}`)
  /* La progresión del fijo pide estar en un estado operativo: el día 1 lo
     deja en Verde manzana, y de ahí sí se puede caer en Morado. */
  await trabajaEl(assignmentId, 12)
  expect(await color(workerId)).toBe('APPLE_GREEN')

  await turnoSinPonchar(assignmentId, 10)

  const { registradas } = await timesheets.detectAbsences(200)

  expect(registradas).toBeGreaterThanOrEqual(1)
  expect(await color(workerId)).toBe('PURPLE')

  const faltas = await db.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM operations.timesheet t
      JOIN operations.timesheet_day d ON d.timesheet_id = t.id
     WHERE t.worker_id = ${workerId}::uuid AND d.is_absence`
  expect(faltas[0]?.n).toBe(1)
})

test('al volver a ponchar sale de Morado, y la falta NO se borra', async () => {
  const { workerId, assignmentId } = await asignado(`Vuelve ${String(Date.now())}`)
  await trabajaEl(assignmentId, 12)
  await turnoSinPonchar(assignmentId, 10)
  await timesheets.detectAbsences(200)
  expect(await color(workerId)).toBe('PURPLE')

  await trabajaEl(assignmentId, 8)

  // Vuelve al estado del que venía, no a uno nuevo.
  expect(await color(workerId)).toBe('APPLE_GREEN')
  const faltas = await db.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM operations.timesheet t
      JOIN operations.timesheet_day d ON d.timesheet_id = t.id
     WHERE t.worker_id = ${workerId}::uuid AND d.is_absence`
  expect(faltas[0]?.n).toBe(1)
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
