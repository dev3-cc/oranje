import { ConflictException, NotFoundException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { AssignmentsRepository } from '../../src/modules/coverage/assignments/assignments.repository.js'
import { AssignmentsService } from '../../src/modules/coverage/assignments/assignments.service.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'
import { WorkersService } from '../../src/modules/personal/workers/workers.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Eliminar del Pool (Hugo, 2026-09-15): nunca borra la fila —`deleted_at` la
 * saca de toda consulta. `WorkersService.delete` por sí sola sigue siendo la
 * red de seguridad (bloquea con una asignación ACTIVA); el camino real es el
 * de `WorkersController` — liberar cada asignación con
 * `AssignmentsService.releaseAllOf` y LUEGO eliminar, que es lo que Hugo pidió
 * («sí se puede eliminar aunque siga trabajando»).
 * La foto también se prueba aquí: `photoPath` ya llega por el mismo `update()`
 * que usa `completeSignup`, así que probarlo contra `WorkersService.update`
 * cubre los dos caminos (Reclutadora y el propio colaborador).
 */

const prisma = db as unknown as PrismaService
const storage = {
  signedUrl: () => Promise.resolve('https://example.test/firmada'),
} as unknown as StorageService
const permissions = new PermissionsService(prisma)
const notificationsFake = { publish: (): Promise<void> => Promise.resolve() } as never
const workers = new WorkersService(
  new WorkersRepository(prisma),
  storage,
  permissions,
  notificationsFake,
)
const assignments = new AssignmentsService(
  new AssignmentsRepository(prisma),
  permissions,
  notificationsFake,
)

let user: AuthenticatedUser
let zoneId: string

const workerIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []

async function bareWorker(etiqueta: string): Promise<string> {
  const white = await db.statusLightState.findFirstOrThrow({
    where: { code: 'WHITE', statusLightCode: 'WORKER' },
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
      statusLightStateId: white.id,
      statusLightCode: 'WORKER',
      createdBy: user.id,
    },
    select: { id: true },
  })
  workerIds.push(worker.id)
  return worker.id
}

async function withActiveAssignment(etiqueta: string): Promise<string> {
  const workerId = await bareWorker(etiqueta)

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel ${etiqueta}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: user.id,
      updatedBy: user.id,
    },
    select: { id: true },
  })
  hotelIds.push(hotel.id)

  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'APPLE_GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `TD${Date.now()}${Math.floor(Math.random() * 100)}`,
      hotelId: hotel.id,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: user.id,
    },
    select: { id: true },
  })
  requisitionIds.push(requisition.id)

  const pos = await db.position.create({
    data: {
      id: uuidv7(),
      requisitionId: requisition.id,
      lineNumber: 1,
      catalogPositionId: position.id,
      hiringModalityId: modality.id,
      hotelDepartmentId: department.id,
      quantity: 1,
      startDate: new Date(),
      startTime: new Date('1970-01-01T07:00:00Z'),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })

  const slot = await db.slot.create({
    data: { id: uuidv7(), positionId: pos.id, ordinal: 1 },
    select: { id: true },
  })

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${uuidv7()}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'FIXED',
            daterange(current_date - 1, NULL), 'ACTIVE', ${user.id}::uuid)`

  return workerId
}

beforeAll(async () => {
  const { id } = await actor()
  const role = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true } })
  user = { id, roleCode: role.role.code, hotelId: null, departmentId: null }
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.assignment.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitionIds } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitionIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })
  await db.journalEntry.deleteMany({ where: { entityId: { in: workerIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await close()
})

test('eliminar deja al colaborador fuera de todo (deleted_at), nunca borra la fila', async () => {
  const id = await bareWorker(`Eliminar ${String(Date.now())}`)

  await workers.delete(id, user)

  await expect(workers.get(id)).rejects.toThrow(NotFoundException)
  const row = await db.worker.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })
  expect(row.deletedAt).not.toBeNull()
})

test('con una asignación ACTIVA, eliminar da 409 WORKER_HAS_ACTIVE_ASSIGNMENT', async () => {
  const id = await withActiveAssignment(`Asignado ${String(Date.now())}`)

  await expect(workers.delete(id, user)).rejects.toThrow(ConflictException)

  const row = await db.worker.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })
  expect(row.deletedAt).toBeNull()
})

test('con una asignación ACTIVA, liberarla primero SÍ permite eliminar', async () => {
  const id = await withActiveAssignment(`Liberado ${String(Date.now())}`)

  await assignments.releaseAllOf(id, 'Colaborador eliminado del Pool', user)
  await workers.delete(id, user)

  const row = await db.worker.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })
  expect(row.deletedAt).not.toBeNull()
  const active = await db.assignment.count({ where: { workerId: id, status: 'ACTIVE' } })
  expect(active).toBe(0)
})

test('la Reclutadora edita el expediente completo, incluida la fecha de nacimiento y el género (Hugo, 2026-09-22)', async () => {
  const id = await bareWorker(`Editar todo ${String(Date.now())}`)

  const updated = await workers.update(
    id,
    { birthDate: new Date('1990-06-15'), gender: 'FEMALE' },
    user,
  )
  expect(updated.birthDate.slice(0, 10)).toBe('1990-06-15')
  expect(updated.gender).toBe('FEMALE')
})

test('editar la fecha de nacimiento hacia una minoría de edad se rechaza igual que en el alta', async () => {
  const id = await bareWorker(`Menor de edad ${String(Date.now())}`)
  const tooYoung = new Date()
  tooYoung.setFullYear(tooYoung.getFullYear() - 10)

  await expect(workers.update(id, { birthDate: tooYoung }, user)).rejects.toMatchObject({
    response: { code: 'WORKER_UNDERAGE' },
  })
})

test('subir la foto llega por el mismo update() que usa completeSignup', async () => {
  const id = await bareWorker(`Foto ${String(Date.now())}`)

  const updated = await workers.update(id, { photoPath: 'workers/photo/prueba.jpg' }, user)
  expect(updated.photoUrl).toBe('https://example.test/firmada')
})
