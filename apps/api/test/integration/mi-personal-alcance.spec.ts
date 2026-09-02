import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'
import { WorkersService } from '../../src/modules/personal/workers/workers.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Mi Personal. Los roles de Hotel llegan a la ficha y al Stand-by por un
 * camino distinto al de Reclutamiento, y con un alcance más chico: solo sobre
 * quien tienen ASIGNADO.
 *
 * Sin ese alcance, `staff:set_standby` abriría las doce transiciones del
 * semáforo sobre cualquier colaborador del Pool.
 */

const prisma = db as unknown as PrismaService
const workers = new WorkersService(
  new WorkersRepository(prisma),
  { signedUrl: (): Promise<null> => Promise.resolve(null) } as never,
  new PermissionsService(prisma),
)

let actorId: string
let zoneId: string
let departmentId: string
let positionId: string
let modalityId: string

const users: string[] = []
const workerIds: string[] = []
const hotels: string[] = []
const requisitions: string[] = []

async function hotel(): Promise<string> {
  const id = uuidv7()

  await db.hotel.create({
    data: {
      id,
      name: `Hotel Alcance ${id.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })

  hotels.push(id)

  return id
}

async function usuario(roleCode: string, hotelId: string | null): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `alcance-${uuidv7().slice(-12)}@oranje.local`,
      fullName: roleCode,
      roleId: role.id,
      hotelId,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode, hotelId, departmentId: null }
}

async function colaborador(stateCode: string): Promise<string> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: stateCode, statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: 'Colaborador asignado',
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: state.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
    select: { id: true },
  })

  workerIds.push(worker.id)

  return worker.id
}

// Lo pone a trabajar en ese hotel: es lo que le da alcance al Hotel sobre él.
async function asignar(workerId: string, hotelId: string): Promise<void> {
  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `A${Date.now()}${Math.floor(Math.random() * 100)}`,
      hotelId,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: actorId,
    },
    select: { id: true },
  })

  requisitions.push(requisition.id)

  const position = await db.position.create({
    data: {
      id: uuidv7(),
      requisitionId: requisition.id,
      lineNumber: 1,
      catalogPositionId: positionId,
      hiringModalityId: modalityId,
      hotelDepartmentId: departmentId,
      quantity: 1,
      startDate: new Date(),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })

  const slot = await db.slot.create({
    data: { id: uuidv7(), positionId: position.id, ordinal: 1 },
    select: { id: true },
  })

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${uuidv7()}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'FIXED',
            daterange(current_date - 1, NULL), 'ACTIVE', ${actorId}::uuid)`
}

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.$executeRaw`DELETE FROM coverage.assignment WHERE worker_id = ANY(${workerIds}::uuid[])`
  await db.workerStateHistory.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitions } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitions } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitions } } })

  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    await db.user.updateMany({
      where: { id: { in: users } },
      data: { isActive: false, hotelId: null },
    })
  }

  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('ver el expediente desde Mi Personal', () => {
  it('el Supervisor ve al que tiene asignado', async () => {
    const hotelId = await hotel()
    const supervisor = await usuario('ROL-H-01', hotelId)
    const workerId = await colaborador('ORANGE')

    await asignar(workerId, hotelId)

    await expect(workers.getScoped(workerId, supervisor)).resolves.toMatchObject({ id: workerId })
  })

  it('no ve a uno del Pool que no trabaja con él', async () => {
    const hotelId = await hotel()
    const supervisor = await usuario('ROL-H-01', hotelId)
    const ajeno = await colaborador('STRONG_GREEN')

    await expect(workers.getScoped(ajeno, supervisor)).rejects.toMatchObject({
      response: { code: 'WORKER_NOT_ASSIGNED_TO_YOU' },
    })
  })

  it('Reclutamiento sigue viendo el Pool entero', async () => {
    const reclutadora = await usuario('ROL-R-01', null)
    const cualquiera = await colaborador('STRONG_GREEN')

    await expect(workers.getScoped(cualquiera, reclutadora)).resolves.toMatchObject({
      id: cualquiera,
    })
  })
})

describe('mandar a Stand-by', () => {
  it('el Supervisor manda a descansar al que tiene asignado', async () => {
    const hotelId = await hotel()
    const supervisor = await usuario('ROL-H-01', hotelId)
    const workerId = await colaborador('ORANGE')

    await asignar(workerId, hotelId)

    // Stand-by exige motivo: el semáforo lo pide y el catálogo lo tiene.
    const entity = await workers.changeState(
      workerId,
      { toState: 'PINK', reasonCode: 'VACATION' },
      supervisor,
    )

    expect(entity.state.code).toBe('PINK')
  })

  it('no puede mandarlo a otro estado: solo Stand-by', async () => {
    const hotelId = await hotel()
    const supervisor = await usuario('ROL-H-01', hotelId)
    const workerId = await colaborador('ORANGE')

    await asignar(workerId, hotelId)

    await expect(
      workers.changeState(workerId, { toState: 'STRONG_GREEN' }, supervisor),
    ).rejects.toMatchObject({ response: { code: 'ONLY_STANDBY' } })
  })

  it('no puede mandar a Stand-by a uno que no es suyo', async () => {
    const hotelId = await hotel()
    const supervisor = await usuario('ROL-H-01', hotelId)
    const ajeno = await colaborador('ORANGE')

    await expect(
      workers.changeState(ajeno, { toState: 'PINK', reasonCode: 'VACATION' }, supervisor),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_ASSIGNED_TO_YOU' } })
  })

  it('un rol sin ninguno de los dos permisos no cambia nada', async () => {
    const contadora = await usuario('ROL-CO-01', null)
    const workerId = await colaborador('ORANGE')

    await expect(
      workers.changeState(workerId, { toState: 'PINK', reasonCode: 'VACATION' }, contadora),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })
})

describe('la Matriz sostiene los dos caminos', () => {
  it('los tres roles de Hotel tienen set_standby y read_history', async () => {
    const permissions = new PermissionsService(prisma)

    for (const role of ['ROL-H-01', 'ROL-H-02', 'ROL-H-03']) {
      expect(await permissions.can(role, 'staff', 'set_standby')).toBe(true)
      expect(await permissions.can(role, 'staff', 'read_history')).toBe(true)
      expect(await permissions.can(role, 'recruitment', 'validate_signup')).toBe(false)
    }
  })
})
