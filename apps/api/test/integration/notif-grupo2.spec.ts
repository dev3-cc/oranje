import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ParticipationRepository } from '../../src/modules/coverage/participation/participation.repository.js'
import { ParticipationService } from '../../src/modules/coverage/participation/participation.service.js'
import { RequisitionsRepository } from '../../src/modules/demand/requisitions/requisitions.repository.js'
import { RequisitionsService } from '../../src/modules/demand/requisitions/requisitions.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'
import { WorkersService } from '../../src/modules/personal/workers/workers.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Cinco eventos del "grupo 2" (Hugo, 2026-09-17): no piden tabla nueva ni
 * cambian ningún semáforo, solo les faltaba el botón. REQ_INSPECTOR_ASSIGNED
 * llena una columna que ya existía; COVERAGE_CLOSURE_REVIEWED es un registro
 * DESPUÉS del cierre automático (RF-05), no lo bloquea; REQ_REASSIGNED mueve
 * la participación de una Reclutadora a otra sin tocar el estado; las dos de
 * "solicitar" (REASSIGN_REQUESTED, UNASSIGN_REQUESTED) solo avisan — quien
 * decide actúa por fuera con lo que ya existía.
 */

const prisma = db as unknown as PrismaService
const places = new PlacesService({ get: () => undefined } as never)
const publishCalls: Array<{ type: string; audience: unknown[] }> = []
const notifications = {
  publish: (event: { type: string; audience: unknown[] }): Promise<void> => {
    publishCalls.push(event)
    return Promise.resolve()
  },
} as never
const storageFake = { signedUrl: (): Promise<null> => Promise.resolve(null) } as never
const permissions = new PermissionsService(prisma)

const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  permissions,
  places,
  storageFake,
  notifications,
)
const participation = new ParticipationService(new ParticipationRepository(prisma), notifications)
const workers = new WorkersService(
  new WorkersRepository(prisma),
  storageFake,
  permissions,
  notifications,
)

let actorUser: AuthenticatedUser
let zoneId: string
const zoneIds: string[] = []
let hotelId: string
let supervisorId: string
let areaManagerId: string
let inspectorId: string
let reclutadoraFromId: string
let reclutadoraToId: string
let liderFromId: string
let liderToId: string

const userIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []
const workerIds: string[] = []

async function usuario(roleCode: string, etiqueta: string, opts: { hotelId?: string } = {}) {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode }, select: { id: true } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `${etiqueta}-${String(Date.now())}-${String(Math.random()).slice(2, 8)}@oranje.local`,
      fullName: etiqueta,
      roleId: role.id,
      hotelId: opts.hotelId ?? null,
    },
    select: { id: true },
  })
  userIds.push(user.id)
  return user.id
}

async function nuevaRequisicion(overrides: {
  createdBy: string
  areaManagerUserId?: string
  stateCode?: string
}): Promise<string> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: overrides.stateCode ?? 'APPLE_GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `TG2${String(Date.now())}${String(Math.floor(Math.random() * 100))}`,
      hotelId,
      statusLightStateId: state.id,
      statusLightCode: 'REQUISITION',
      createdBy: overrides.createdBy,
      areaManagerUserId: overrides.areaManagerUserId ?? null,
    },
    select: { id: true },
  })
  requisitionIds.push(requisition.id)

  await db.position.create({
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
  })

  return requisition.id
}

beforeAll(async () => {
  const { id } = await actor()
  const role = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true } })
  actorUser = { id, roleCode: role.role.code, hotelId: null, departmentId: null }
  // Zona propia, no una compartida: la base tiene Inspectores de pruebas
  // viejas ya asignados a las zonas del catálogo, y `inspectorOfZone` no
  // sabría distinguir cuál es "el mío".
  zoneId = (
    await db.zone.create({
      data: { id: uuidv7(), code: `G2-${String(Date.now())}`, name: 'Zona Grupo2' },
      select: { id: true },
    })
  ).id
  zoneIds.push(zoneId)

  hotelId = (
    await db.hotel.create({
      data: {
        id: uuidv7(),
        name: `Hotel Grupo2 ${String(Date.now())}`,
        zoneId,
        timeZone: 'America/Cancun',
        createdBy: id,
        updatedBy: id,
      },
      select: { id: true },
    })
  ).id
  hotelIds.push(hotelId)

  supervisorId = await usuario('ROL-H-01', 'Supervisor G2', { hotelId })
  areaManagerId = await usuario('ROL-H-02', 'Manager de Área G2', { hotelId })
  inspectorId = await usuario('ROL-I-01', 'Inspector G2')
  await db.userZone.create({ data: { userId: inspectorId, zoneId } })

  liderFromId = await usuario('ROL-R-02', 'Líder Origen G2')
  liderToId = await usuario('ROL-R-02', 'Líder Destino G2')
  reclutadoraFromId = await usuario('ROL-R-01', 'Reclutadora Origen G2')
  reclutadoraToId = await usuario('ROL-R-01', 'Reclutadora Destino G2')
  await db.user.update({ where: { id: reclutadoraFromId }, data: { reportsToUserId: liderFromId } })
  await db.user.update({ where: { id: reclutadoraToId }, data: { reportsToUserId: liderToId } })
})

afterAll(async () => {
  await db.participation.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.assignment.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.journalEntry.deleteMany({
    where: {
      OR: [{ entityId: { in: requisitionIds } }, { entityId: { in: workerIds } }],
    },
  })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitionIds } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitionIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await db.userZone.deleteMany({ where: { userId: inspectorId } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })
  await db.zone.deleteMany({ where: { id: { in: zoneIds } } })
  await close()
})

describe('REQ_INSPECTOR_ASSIGNED', () => {
  test('autorizar llena inspector_id con el Inspector de la zona y le avisa', async () => {
    const id = await nuevaRequisicion({ createdBy: supervisorId, areaManagerUserId: areaManagerId })
    publishCalls.length = 0

    await requisitions.authorize(id, actorUser)

    const row = await db.requisition.findUniqueOrThrow({
      where: { id },
      select: { inspectorId: true },
    })
    expect(row.inspectorId).toBe(inspectorId)

    const sent = publishCalls.find((c) => c.type === 'REQ_INSPECTOR_ASSIGNED')
    expect(sent).toBeDefined()
    expect(sent?.audience).toContainEqual({ kind: 'USER', userId: inspectorId })
  })
})

describe('COVERAGE_CLOSURE_REVIEWED', () => {
  test('revisar una requisición que no está cerrada da 409', async () => {
    const id = await nuevaRequisicion({ createdBy: supervisorId })

    await expect(requisitions.reviewClosure(id, { approved: true }, actorUser)).rejects.toThrow(
      ConflictException,
    )
  })

  test('objetar sin motivo da 422', async () => {
    const id = await nuevaRequisicion({ createdBy: supervisorId, stateCode: 'LIGHT_BLUE' })

    await expect(requisitions.reviewClosure(id, { approved: false }, actorUser)).rejects.toThrow(
      UnprocessableEntityException,
    )
  })

  test('aprobar una cerrada la registra en el journal y avisa a las Reclutadoras', async () => {
    const id = await nuevaRequisicion({ createdBy: supervisorId, stateCode: 'LIGHT_BLUE' })
    await db.participation.create({
      data: { id: uuidv7(), requisitionId: id, userId: reclutadoraFromId },
    })
    publishCalls.length = 0

    await requisitions.reviewClosure(id, { approved: true }, actorUser)

    const entry = await db.journalEntry.findFirst({
      where: { entityId: id, eventType: 'COVERAGE_CLOSURE_REVIEWED' },
    })
    expect(entry).not.toBeNull()

    const sent = publishCalls.find((c) => c.type === 'COVERAGE_CLOSURE_REVIEWED')
    expect(sent).toBeDefined()
    expect(sent?.audience).toContainEqual({ kind: 'REQUISITION_RECRUITERS', requisitionId: id })
  })
})

describe('REQ_REASSIGNED', () => {
  test('reasignar mueve la participación y avisa a las dos y a sus dos Líderes', async () => {
    const id = await nuevaRequisicion({ createdBy: supervisorId, stateCode: 'YELLOW' })
    await db.participation.create({
      data: { id: uuidv7(), requisitionId: id, userId: reclutadoraFromId },
    })
    publishCalls.length = 0

    const result = await participation.reassign(id, reclutadoraFromId, reclutadoraToId, actorUser)

    expect(result.participants.map((p) => p.user.id)).toEqual([reclutadoraToId])

    const sent = publishCalls.find((c) => c.type === 'REQ_REASSIGNED')
    expect(sent).toBeDefined()
    const audience = sent?.audience as Array<{ userId: string }>
    const ids = audience.map((a) => a.userId).sort()
    expect(ids).toEqual([reclutadoraFromId, reclutadoraToId, liderFromId, liderToId].sort())
  })

  test('reasignar a quien ya participa da 409', async () => {
    const id = await nuevaRequisicion({ createdBy: supervisorId, stateCode: 'YELLOW' })
    await db.participation.createMany({
      data: [
        { id: uuidv7(), requisitionId: id, userId: reclutadoraFromId },
        { id: uuidv7(), requisitionId: id, userId: reclutadoraToId },
      ],
    })

    await expect(
      participation.reassign(id, reclutadoraFromId, reclutadoraToId, actorUser),
    ).rejects.toThrow(ConflictException)
  })
})

describe('REASSIGN_REQUESTED / UNASSIGN_REQUESTED', () => {
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
        phone: '9990000099',
        address: 'Calle 9',
        zoneId,
        statusLightStateId: white.id,
        statusLightCode: 'WORKER',
        createdBy: actorUser.id,
      },
      select: { id: true },
    })
    workerIds.push(worker.id)
    return worker.id
  }

  test('solicitar reasignación solo avisa al Manager de Reclutamiento', async () => {
    const id = await bareWorker(`Reasignar ${String(Date.now())}`)
    publishCalls.length = 0

    await workers.requestReassignment(id, { reason: 'sobrecarga en su zona' }, actorUser)

    const entry = await db.journalEntry.findFirst({
      where: { entityId: id, eventType: 'REASSIGN_REQUESTED' },
    })
    expect(entry).not.toBeNull()
    const sent = publishCalls.find((c) => c.type === 'REASSIGN_REQUESTED')
    expect(sent).toBeDefined()
  })

  test('solicitar desasignar sin asignación activa da 409', async () => {
    const id = await bareWorker(`SinAsignar ${String(Date.now())}`)

    await expect(workers.requestUnassignment(id, {}, actorUser)).rejects.toThrow(ConflictException)
  })

  test('solicitar desasignar con asignación activa avisa al hotel', async () => {
    const workerId = await bareWorker(`ConAsignacion ${String(Date.now())}`)
    const requisitionId = await nuevaRequisicion({ createdBy: supervisorId })
    const position = await db.position.findFirstOrThrow({
      where: { requisitionId },
      select: { id: true },
    })
    const slot = await db.slot.create({
      data: { id: uuidv7(), positionId: position.id, ordinal: 1 },
      select: { id: true },
    })
    await db.$executeRaw`
      INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
      VALUES (${uuidv7()}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'FIXED',
              daterange(current_date - 1, NULL), 'ACTIVE', ${actorUser.id}::uuid)`
    publishCalls.length = 0

    await workers.requestUnassignment(workerId, {}, actorUser)

    const sent = publishCalls.find((c) => c.type === 'UNASSIGN_REQUESTED')
    expect(sent).toBeDefined()
    expect(sent?.audience).toContainEqual({
      kind: 'ROLE_IN_HOTEL',
      roleCode: 'ROL-H-01',
      hotelId,
    })
  })
})
