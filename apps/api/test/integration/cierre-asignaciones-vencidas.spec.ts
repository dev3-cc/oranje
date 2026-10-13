import { v7 as uuidv7 } from 'uuid'

import { SYSTEM_USER_EMAIL } from '../../src/common/constants/system-actor.js'
import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { AssignmentsRepository } from '../../src/modules/coverage/assignments/assignments.repository.js'
import { AssignmentsService } from '../../src/modules/coverage/assignments/assignments.service.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El cierre automático de la asignación temporal vencida (Hugo, 2026-10-09).
 *
 * El vault dice que «se cierra automáticamente al vencer esos días» y nadie lo
 * hacía: quedaban ACTIVE para siempre, con su slot ocupado, y la persona no
 * volvía a aparecer como asignable.
 */
const prisma = db as unknown as PrismaService
const repo = new AssignmentsRepository(prisma)
const workers = new WorkersRepository(prisma)
const service = new AssignmentsService(repo, new PermissionsService(prisma), {
  publish: (): Promise<void> => Promise.resolve(),
} as never)

let user: AuthenticatedUser
let zoneId: string
let positionId: string
let requisitionId: string
let enProcesoId: string

const workerIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []

async function colaborador(etiqueta: string): Promise<string> {
  const verde = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const w = await db.worker.create({
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
  workerIds.push(w.id)
  return w.id
}

/** Una temporal con su último día ya pasado, como las que quedaron vivas. */
async function temporalVencida(workerId: string, ordinal: number): Promise<string> {
  const slot = await db.slot.findFirstOrThrow({
    where: { positionId, ordinal },
    select: { id: true },
  })
  const id = uuidv7()
  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${id}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'TEMPORARY',
            daterange(current_date - 30, current_date - 5), 'ACTIVE', ${user.id}::uuid)`
  await db.slot.update({ where: { id: slot.id }, data: { status: 'taken' } })
  return id
}

beforeAll(async () => {
  const { id } = await actor()
  const role = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true } })
  user = { id, roleCode: role.role.code, hotelId: null, departmentId: null }
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel vencidas ${String(Date.now())}`,
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
  enProcesoId = enProceso.id
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })
  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `VE${Date.now()}${String(Math.floor(Math.random() * 100))}`,
      hotelId: hotel.id,
      statusLightStateId: enProceso.id,
      statusLightCode: 'REQUISITION',
      createdBy: user.id,
    },
    select: { id: true },
  })
  requisitionIds.push(requisition.id)
  requisitionId = requisition.id

  const position = await db.position.create({
    data: {
      id: uuidv7(),
      requisitionId: requisition.id,
      lineNumber: 1,
      catalogPositionId: (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id,
      hiringModalityId: (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id,
      hotelDepartmentId: (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id,
      quantity: 8,
      startDate: new Date(),
      startTime: new Date('1970-01-01T07:00:00Z'),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })
  positionId = position.id
  for (const ordinal of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await db.slot.create({ data: { id: uuidv7(), positionId, ordinal, status: 'free' } })
  }
})

afterAll(async () => {
  const pasos: Array<() => Promise<unknown>> = [
    () => db.assignment.deleteMany({ where: { workerId: { in: workerIds } } }),
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
      /* La limpieza no puede dejar basura por un paso que falle. */
    }
  }
  await close()
})

test('la cuenta del Sistema existe: sin ella el cierre no puede firmar', async () => {
  const sistema = await repo.systemActor(SYSTEM_USER_EMAIL)
  expect(sistema).not.toBeNull()
  expect(sistema?.roleCode).toBe('ROL-SYS-01')
})

test('cierra la vencida como CLOSED, libera su slot y deja rastro del Sistema', async () => {
  const workerId = await colaborador(`Vencida ${String(Date.now())}`)
  const assignmentId = await temporalVencida(workerId, 1)

  const { cerradas } = await service.closeExpired(50, workerId)
  expect(cerradas).toBe(1)

  const fila = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { status: true, closedReason: true },
  })
  // CLOSED, no CANCELLED: se le acabaron los días, nadie la soltó a mano.
  expect(fila.status).toBe('CLOSED')
  expect(fila.closedReason).toContain('plazo')

  const slot = await db.slot.findFirstOrThrow({
    where: { positionId, ordinal: 1 },
    select: { status: true },
  })
  expect(slot.status).toBe('free')

  const rastro = await db.journalEntry.findFirst({
    where: { entityId: assignmentId, eventType: 'ASSIGNMENT_CLOSED' },
    select: { actorRole: true },
  })
  expect(rastro?.actorRole).toBe('ROL-SYS-01')
})

test('una temporal que corre hasta hoy NO se cierra', async () => {
  const workerId = await colaborador(`Vigente ${String(Date.now())}`)
  const slot = await db.slot.findFirstOrThrow({
    where: { positionId, ordinal: 2 },
    select: { id: true },
  })
  const id = uuidv7()
  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${id}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'TEMPORARY',
            daterange(current_date - 3, current_date + 1), 'ACTIVE', ${user.id}::uuid)`

  const { cerradas } = await service.closeExpired(50, workerId)

  expect(cerradas).toBe(0)
  const fila = await db.assignment.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  })
  expect(fila.status).toBe('ACTIVE')
})

test('una requisición ya cerrada no impide liberar a la persona', async () => {
  const workerId = await colaborador(`Cerrada ${String(Date.now())}`)
  const assignmentId = await temporalVencida(workerId, 3)

  // Cubierta: `release` se niega a tocarla porque recalcularía su cobertura.
  const cubierta = await db.statusLightState.findFirstOrThrow({
    where: { code: 'LIGHT_BLUE', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  await db.requisition.update({
    where: { id: requisitionId },
    data: { statusLightStateId: cubierta.id },
  })

  const { cerradas, fallidas } = await service.closeExpired(50, workerId)

  expect({ cerradas, fallidas }).toEqual({ cerradas: 1, fallidas: 0 })
  const fila = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { status: true },
  })
  expect(fila.status).toBe('CLOSED')
  // El slot NO se libera: la requisición es historia y no se reabre.
  const slot = await db.slot.findFirstOrThrow({
    where: { positionId, ordinal: 3 },
    select: { status: true },
  })
  expect(slot.status).toBe('taken')

  /* Se devuelve a En proceso: cerrar la requisición es el montaje de ESTA
     prueba, y dejarla cerrada impide asignar en las siguientes. */
  await db.requisition.update({
    where: { id: requisitionId },
    data: { statusLightStateId: enProcesoId },
  })
})

async function códigoDelEstado(workerId: string): Promise<string> {
  const w = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    select: { statusState: { select: { code: true } } },
  })
  return w.statusState.code
}

test('el semáforo se mueve solo: Verde fuerte → Café al asignar, y de vuelta al vencer', async () => {
  const workerId = await colaborador(`Semáforo ${String(Date.now())}`)
  expect(await códigoDelEstado(workerId)).toBe('STRONG_GREEN')

  const creada = await service.create(
    {
      positionId,
      slotOrdinal: 6,
      workerId,
      type: 'TEMPORARY',
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    } as never,
    user,
  )
  // Asignar temporalmente lo pone en Café, sin que nadie lo mueva a mano.
  expect(await códigoDelEstado(workerId)).toBe('BROWN')

  // Se le acaban los días: se vence a mano para no esperar tres días.
  await db.$executeRaw`
    UPDATE coverage.assignment SET validity = daterange(current_date - 10, current_date - 1)
     WHERE id = ${creada.assignment.id}::uuid`

  const { cerradas } = await service.closeExpired(50, workerId)

  expect(cerradas).toBe(1)
  // Y vuelve de donde venía, que es lo que la transición sembrada promete.
  expect(await códigoDelEstado(workerId)).toBe('STRONG_GREEN')

  const historia = await db.workerStateHistory.findMany({
    where: { workerId },
    orderBy: { occurredAt: 'asc' },
    select: { toState: { select: { code: true } } },
  })
  expect(historia.map((h) => h.toState.code)).toEqual(['BROWN', 'STRONG_GREEN'])
})

test('una asignación FIJA no mueve el semáforo: eso espera al día 1', async () => {
  const workerId = await colaborador(`Fija ${String(Date.now())}`)

  await service.create({ positionId, slotOrdinal: 7, workerId, type: 'FIXED' } as never, user)

  expect(await códigoDelEstado(workerId)).toBe('STRONG_GREEN')
})

test('a quien terminó su temporal ya se le puede asignar otra vez (Hugo, 2026-10-09)', async () => {
  const workerId = await colaborador(`Reasignable ${String(Date.now())}`)
  await temporalVencida(workerId, 4)

  /* Este era el error que veía Hugo: la lista lo ofrecía y el servidor
     respondía «ya tiene una asignación activa». Ahora `create` cierra primero
     lo vencido de esa persona, así que el camino completo pasa. */
  const creada = await service.create(
    { positionId, slotOrdinal: 5, workerId, type: 'FIXED' } as never,
    user,
  )

  expect(creada.assignment.slot.ordinal).toBe(5)
  const vieja = await db.assignment.count({
    where: { workerId, status: 'ACTIVE', slot: { ordinal: 4 } },
  })
  expect(vieja).toBe(0)
})

test('al terminar una fija, de Naranja vuelve a Verde fuerte', async () => {
  const workerId = await colaborador(`Naranja ${String(Date.now())}`)
  const creada = await service.create(
    { positionId, slotOrdinal: 8, workerId, type: 'FIXED' } as never,
    user,
  )

  /* Como si ya hubiera cumplido sus 7 días: el fijo llega a Naranja por los
     ponches, que se prueban aparte. */
  const naranja = await db.statusLightState.findFirstOrThrow({
    where: { code: 'ORANGE', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  await db.worker.update({ where: { id: workerId }, data: { statusLightStateId: naranja.id } })

  await service.release(creada.assignment.id, 'Terminó en el hotel', user)

  const w = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    select: { statusState: { select: { code: true } } },
  })
  expect(w.statusState.code).toBe('STRONG_GREEN')
})

test('la lista de asignables deja de esconder a quien ya terminó', async () => {
  const marca = String(Date.now())
  const terminó = await colaborador(`Terminó ${marca}`)
  await temporalVencida(terminó, 1)

  const asignables = await workers.findMany({
    page: 1,
    limit: 100,
    state: 'STRONG_GREEN',
    search: `Terminó ${marca}`,
    onlyAvailable: false,
    hasPendingDocument: false,
    withoutActiveAssignment: true,
  })

  expect(asignables.rows.map((r) => r.id)).toEqual([terminó])
})
