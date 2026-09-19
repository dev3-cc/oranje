import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TerritoriesRepository } from '../../src/modules/commercial/territories/territories.repository.js'
import { TerritoriesService } from '../../src/modules/commercial/territories/territories.service.js'
import { AssignmentsRepository } from '../../src/modules/coverage/assignments/assignments.repository.js'
import { AssignmentsService } from '../../src/modules/coverage/assignments/assignments.service.js'
import { RequisitionsRepository } from '../../src/modules/demand/requisitions/requisitions.repository.js'
import { RequisitionsService } from '../../src/modules/demand/requisitions/requisitions.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Hugo (2026-09-19): "hotel manager ve más hoteles que el suyo" — cierto, y
 * el mismo patrón (una llave de permiso compartida por dos roles con
 * alcances distintos, sin que el código lo distinga) se repetía en dos
 * lugares más, encontrados en esta auditoría. Los tres casos:
 *
 * 1. `RequisitionsService.list()` — `requisitions:read_all` la comparten el
 *    Manager General («todos los deptos de MI hotel») y Reclutamiento
 *    («todos los hoteles»); el código quitaba el filtro de hotel para
 *    cualquiera con el permiso, así que el Manager General veía TODOS los
 *    hoteles.
 * 2. `AssignmentsService.list()` — ni siquiera comparaba el hotel: cualquier
 *    rol de Hotel con `read_own` podía pedir las asignaciones de CUALQUIER
 *    requisición con solo su id.
 * 3. `TerritoriesService.get()` — `team:read_members` la comparten el BDC
 *    (Mi Equipo) y el Manager de Reclutamiento (su propio equipo); sin
 *    verificar que la persona en realidad reporte al que pregunta, cualquiera
 *    de los dos leía el territorio de cualquier persona.
 */

const prisma = db as unknown as PrismaService
const permissions = new PermissionsService(prisma)
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const storageFake = { signedUrl: (): Promise<null> => Promise.resolve(null) } as never
const places = new PlacesService({ get: () => undefined } as never)

const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  permissions,
  places,
  storageFake,
  notifications,
)
const assignments = new AssignmentsService(
  new AssignmentsRepository(prisma),
  permissions,
  notifications,
)
const territories = new TerritoriesService(new TerritoriesRepository(prisma), permissions)

let zoneId: string
let departmentId: string
let positionId: string
let modalityId: string
let hotelId: string
let otherHotelId: string

const userIds: string[] = []
const hotelIds: string[] = []
const requisitionIds: string[] = []
const workerIds: string[] = []

async function usuario(
  roleCode: string,
  etiqueta: string,
  scopeHotelId: string | null,
  reportsToUserId: string | null = null,
): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode }, select: { id: true } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `${etiqueta}-${String(Date.now())}-${String(Math.random()).slice(2, 8)}@oranje.local`,
      fullName: etiqueta,
      roleId: role.id,
      hotelId: scopeHotelId,
      reportsToUserId,
    },
    select: { id: true },
  })
  userIds.push(user.id)

  return { id: user.id, roleCode, hotelId: scopeHotelId, departmentId: null }
}

async function requisicion(targetHotelId: string, user: AuthenticatedUser): Promise<string> {
  const entity = await requisitions.create(
    {
      hotelId: targetHotelId,
      positions: [
        {
          catalogPositionId: positionId,
          hiringModalityId: modalityId,
          hotelDepartmentId: departmentId,
          quantity: 1,
          startDate: new Date(Date.now() + 7 * 86_400_000),
        },
      ],
    },
    user,
  )
  requisitionIds.push(entity.id)

  return entity.id
}

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
      phone: '9990000098',
      address: 'Calle 8',
      zoneId,
      statusLightStateId: white.id,
      statusLightCode: 'WORKER',
      createdBy: (await actor()).id,
    },
    select: { id: true },
  })
  workerIds.push(worker.id)

  return worker.id
}

beforeAll(async () => {
  const actorId = (await actor()).id

  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel Fuga ${Date.now()}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })
  const other = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel Fuga Ajeno ${Date.now()}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })
  hotelIds.push(hotel.id, other.id)
  hotelId = hotel.id
  otherHotelId = other.id
})

afterAll(async () => {
  await db.participation.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.assignment.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.journalEntry.deleteMany({ where: { actorUserId: { in: userIds } } })
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitionIds } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitionIds } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitionIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await db.userZone.deleteMany({ where: { userId: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })

  await close()
})

describe('el Manager General solo ve requisiciones de SU hotel', () => {
  it('read_all no levanta el filtro de hotel', async () => {
    const supervisorMio = await usuario('ROL-H-01', 'sup-fuga-mio', hotelId)
    const supervisorAjeno = await usuario('ROL-H-01', 'sup-fuga-ajeno', otherHotelId)
    const gm = await usuario('ROL-H-03', 'gm-fuga', hotelId)

    const mine = await requisicion(hotelId, supervisorMio)
    const foreign = await requisicion(otherHotelId, supervisorAjeno)

    const board = await requisitions.list({ page: 1, limit: 100, includeDeleted: false }, gm)
    const ids = board.data.map((r) => r.id)

    expect(ids).toContain(mine)
    expect(ids).not.toContain(foreign)
  })
})

describe('las asignaciones de una requisición se acotan por hotel', () => {
  it('un rol de Hotel no ve las asignaciones de OTRO hotel', async () => {
    const supervisorAjeno = await usuario('ROL-H-01', 'sup-asig-ajeno', otherHotelId)
    const gm = await usuario('ROL-H-03', 'gm-asig-mio', hotelId)

    const foreignRequisitionId = await requisicion(otherHotelId, supervisorAjeno)
    // `requisicion()` ya crea 1 posición con 1 slot (quantity: 1): se reusa,
    // crear otro con el mismo ordinal choca contra `ux_slot_position_ordinal`.
    const slot = await db.slot.findFirstOrThrow({
      where: { position: { requisitionId: foreignRequisitionId } },
      select: { id: true },
    })
    const workerId = await bareWorker(`AsigFuga ${String(Date.now())}`)
    await db.$executeRaw`
      INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
      VALUES (${uuidv7()}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'FIXED',
              daterange(current_date - 1, NULL), 'ACTIVE', ${gm.id}::uuid)`

    await expect(assignments.list(foreignRequisitionId, gm)).rejects.toMatchObject({
      response: { code: 'HOTEL_OUT_OF_SCOPE' },
    })
  })
})

describe('el territorio de una persona solo lo ve su jefe', () => {
  it('el Manager de Reclutamiento NO lee el territorio de un BD ajeno', async () => {
    const bdc = await usuario('ROL-V-02', 'bdc-terr-fuga', null)
    const bd = await usuario('ROL-V-01', 'bd-terr-fuga', null, bdc.id)
    const mgrReclutamiento = await usuario('ROL-R-03', 'mgr-recl-terr-fuga', null)

    await expect(territories.get(bd.id, mgrReclutamiento)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    })
  })

  it('el BDC SÍ lee el territorio de SU BD (no se rompió el camino real)', async () => {
    const bdc = await usuario('ROL-V-02', 'bdc-terr-ok', null)
    const bd = await usuario('ROL-V-01', 'bd-terr-ok', null, bdc.id)

    await expect(territories.get(bd.id, bdc)).resolves.toMatchObject({
      user: { id: bd.id },
    })
  })
})
