import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { AssignmentsRepository } from '../../src/modules/coverage/assignments/assignments.repository.js'
import { AssignmentsService } from '../../src/modules/coverage/assignments/assignments.service.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Elegir a qué lugar se asigna (Hugo, 2026-10-09).
 *
 * Antes el servidor tomaba siempre el primero libre. Ahora acepta un ordinal;
 * sin él se comporta igual que siempre, que es como sigue entrando el
 * Self-Pick.
 */
const prisma = db as unknown as PrismaService
const service = new AssignmentsService(
  new AssignmentsRepository(prisma),
  new PermissionsService(prisma),
  {
    publish: (): Promise<void> => Promise.resolve(),
  } as never,
)

let user: AuthenticatedUser
let zoneId: string
let positionId: string

const workerIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []

async function disponible(etiqueta: string): Promise<string> {
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
  return worker.id
}

beforeAll(async () => {
  const { id } = await actor()
  const role = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true } })
  user = { id, roleCode: role.role.code, hotelId: null, departmentId: null }
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel elegir ${String(Date.now())}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: user.id,
      updatedBy: user.id,
    },
    select: { id: true },
  })
  hotelIds.push(hotel.id)

  /* En proceso: es el único estado desde el que se puede asignar. */
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
      number: `EL${Date.now()}${String(Math.floor(Math.random() * 100))}`,
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
      quantity: 3,
      startDate: new Date(),
      startTime: new Date('1970-01-01T07:00:00Z'),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })
  positionId = position.id

  for (const ordinal of [1, 2, 3]) {
    await db.slot.create({ data: { id: uuidv7(), positionId, ordinal } })
  }
})

afterAll(async () => {
  /*
   * Asignar cierra la cobertura y eso escribe `requisition_state_history`: sin
   * borrarla primero, la FK tumba el borrado de la requisición, `afterAll`
   * muere ahí y los colaboradores de prueba se quedan en la base compartida
   * —y aparecen en el Pool de quien esté probando (pasó el 2026-10-09)—.
   * Cada paso va protegido por la misma razón: un fallo temprano no puede
   * impedir que se borre lo que sí ensucia a los demás.
   */
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
  const fallos: unknown[] = []
  for (const paso of pasos) {
    try {
      await paso()
    } catch (error) {
      fallos.push(error)
    }
  }
  await close()
  if (fallos.length > 0) throw new Error(`La limpieza dejó basura: ${String(fallos[0])}`)
})

test('con el ordinal se ocupa ESE lugar, no el primero libre', async () => {
  const workerId = await disponible(`Elegido ${String(Date.now())}`)

  const result = await service.create(
    { positionId, slotOrdinal: 3, workerId, type: 'FIXED' } as never,
    user,
  )

  expect(result.assignment.slot.ordinal).toBe(3)
  const libres = await db.slot.findMany({
    where: { positionId, status: 'free' },
    select: { ordinal: true },
    orderBy: { ordinal: 'asc' },
  })
  expect(libres.map((s) => s.ordinal)).toEqual([1, 2])
})

test('sin ordinal se sigue tomando el primero libre', async () => {
  const workerId = await disponible(`Primero ${String(Date.now())}`)

  const result = await service.create({ positionId, workerId, type: 'FIXED' } as never, user)

  expect(result.assignment.slot.ordinal).toBe(1)
})

test('un lugar ya ocupado se rechaza con SLOT_TAKEN, no con el error del motor', async () => {
  const workerId = await disponible(`Chocado ${String(Date.now())}`)

  await expect(
    service.create({ positionId, slotOrdinal: 1, workerId, type: 'FIXED' } as never, user),
  ).rejects.toThrow(ConflictException)
})

test('un ordinal que esta posición no tiene se rechaza', async () => {
  const workerId = await disponible(`Inexistente ${String(Date.now())}`)

  await expect(
    service.create({ positionId, slotOrdinal: 99, workerId, type: 'FIXED' } as never, user),
  ).rejects.toThrow(UnprocessableEntityException)
})
