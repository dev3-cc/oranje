import { v7 as uuidv7 } from 'uuid'

import type { PrismaService } from '../../src/infra/prisma/index.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Quién puede recibir una asignación (Hugo, 2026-10-09).
 *
 * El semáforo NO alcanza para saberlo: Verde fuerte avanza con el primer
 * ponche, no al asignar, así que entre una cosa y la otra la persona sigue
 * viéndose Disponible. La pantalla de asignación la ofrecía y
 * `POST /assignments` la rechazaba después con `WORKER_ALREADY_ASSIGNED`.
 */
const prisma = db as unknown as PrismaService
const repo = new WorkersRepository(prisma)

let userId: string
let zoneId: string
let verdeFuerteId: string

const workerIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []

/** Un colaborador Disponible, con nombre único para encontrarlo en la lista. */
async function disponible(etiqueta: string): Promise<string> {
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: etiqueta,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: verdeFuerteId,
      statusLightCode: 'WORKER',
      createdBy: userId,
    },
    select: { id: true },
  })
  workerIds.push(worker.id)
  return worker.id
}

/** Le cuelga una asignación ACTIVA sin tocar su semáforo: ese es el caso real. */
async function asignar(workerId: string, etiqueta: string): Promise<void> {
  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel ${etiqueta}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: userId,
      updatedBy: userId,
    },
    select: { id: true },
  })
  hotelIds.push(hotel.id)

  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'APPLE_GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })

  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `AS${Date.now()}${String(Math.floor(Math.random() * 100))}`,
      hotelId: hotel.id,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: userId,
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
            daterange(current_date - 1, NULL), 'ACTIVE', ${userId}::uuid)`
}

beforeAll(async () => {
  const { id } = await actor()
  userId = id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  verdeFuerteId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.assignment.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitionIds } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitionIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await close()
})

test('el filtro deja fuera a quien ya tiene una asignación activa, aunque siga en Verde fuerte', async () => {
  const marca = String(Date.now())
  const libre = await disponible(`Libre ${marca}`)
  const ocupado = await disponible(`Ocupado ${marca}`)
  await asignar(ocupado, marca)

  const base = {
    page: 1,
    limit: 100,
    state: 'STRONG_GREEN',
    search: marca,
    onlyAvailable: false,
    hasPendingDocument: false,
  }

  // Sin el filtro, los dos salen: el semáforo no distingue.
  const todos = await repo.findMany({ ...base, withoutActiveAssignment: false })
  expect(todos.rows.map((r) => r.id).sort()).toEqual([libre, ocupado].sort())

  // Con el filtro, solo el que de verdad se puede asignar.
  const asignables = await repo.findMany({ ...base, withoutActiveAssignment: true })
  expect(asignables.rows.map((r) => r.id)).toEqual([libre])
  expect(asignables.total).toBe(1)
})
