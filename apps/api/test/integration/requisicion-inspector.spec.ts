import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { RequisitionsRepository } from '../../src/modules/demand/requisitions/requisitions.repository.js'
import { RequisitionsService } from '../../src/modules/demand/requisitions/requisitions.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Inspector puede crear requisiciones (Reglas de Negocio, 2026-09-24), pero
 * solo para hoteles dentro de las zonas que le asignó su Coordinador — no
 * tiene un hotel fijo como Supervisor/Manager de Área/Manager General.
 */

const prisma = db as unknown as PrismaService
const places = new PlacesService({
  get: (k: string) => (k === 'GOOGLE_MAPS_BROWSER_KEY' ? 'llave-de-prueba' : undefined),
} as never)
const storage = { signedUrl: (path: string): Promise<string> => Promise.resolve(path) } as never

const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  new PermissionsService(prisma),
  places,
  storage,
  { publish: (): Promise<void> => Promise.resolve() } as never,
)

let departmentId: string
let positionId: string
let modalityId: string

const created: string[] = []
const users: string[] = []
const hotels: string[] = []

async function hotelInZone(zoneId: string): Promise<string> {
  const actorId = (await actor()).id
  const id = uuidv7()

  await db.hotel.create({
    data: {
      id,
      name: `Hotel Zona ${id.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })

  hotels.push(id)

  return id
}

async function inspector(zoneIds: string[]): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-I-01' } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `req-inspector-${uuidv7().slice(-12)}@oranje.local`,
      fullName: 'Inspector de zona',
      roleId: role.id,
    },
    select: { id: true },
  })

  users.push(user.id)

  await db.userZone.createMany({
    data: zoneIds.map((zoneId) => ({ userId: user.id, zoneId })),
  })

  return { id: user.id, roleCode: 'ROL-I-01', hotelId: null, departmentId: null }
}

/** El Manager General que crea el borrador que el Inspector va a autorizar. */
async function generalManager(hotelId: string): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-H-03' } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `req-gm-${uuidv7().slice(-12)}@oranje.local`,
      fullName: 'Manager General',
      roleId: role.id,
      hotelId,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode: 'ROL-H-03', hotelId, departmentId: null }
}

function positions(): Array<{
  catalogPositionId: string
  hiringModalityId: string
  hotelDepartmentId: string
  quantity: number
  startDate: Date
  startTime: string
}> {
  return [
    {
      catalogPositionId: positionId,
      hiringModalityId: modalityId,
      hotelDepartmentId: departmentId,
      quantity: 1,
      startDate: new Date(Date.now() + 7 * 86_400_000),
      startTime: '07:00',
    },
  ]
}

beforeAll(async () => {
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId: { in: created } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: created } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: created } } })
  await db.requisition.deleteMany({ where: { id: { in: created } } })
  await db.userZone.deleteMany({ where: { userId: { in: users } } })

  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    // Los GM de prueba llevan `hotelId`; sin soltarlo aquí el `hotel.deleteMany`
    // de abajo choca con `user_hotel_id_fkey`.
    await db.user.updateMany({
      where: { id: { in: users } },
      data: { isActive: false, hotelId: null },
    })
  }

  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('el Inspector crea requisiciones acotado a su zona', () => {
  it('crea para un hotel de su zona', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelId = await hotelInZone(suZona.id)
    const user = await inspector([suZona.id, otraZona.id])

    const entity = await requisitions.create({ hotelId, positions: positions() }, user)
    created.push(entity.id)

    expect(entity.hotel.id).toBe(hotelId)
  })

  it('rechaza un hotel fuera de sus zonas con HOTEL_OUT_OF_ZONE', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelAjeno = await hotelInZone(otraZona.id)
    const user = await inspector([suZona.id])

    await expect(
      requisitions.create({ hotelId: hotelAjeno, positions: positions() }, user),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_ZONE' } })
  })
})

/**
 * El Inspector también autoriza, acotado a la misma zona (regla reabierta el
 * 2026-09-26, decisión de Hugo), sin restricción de departamento — como el
 * Manager General, porque el Inspector no se divide por departamento.
 */
describe('el Inspector autoriza requisiciones acotado a su zona', () => {
  it('autoriza una requisición de un hotel de su zona', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelId = await hotelInZone(suZona.id)
    const gg = await generalManager(hotelId)
    const draft = await requisitions.create({ hotelId, positions: positions() }, gg)
    created.push(draft.id)

    const user = await inspector([suZona.id, otraZona.id])
    const authorized = await requisitions.authorize(draft.id, user)

    expect(authorized.state.code).toBe('GREEN')
  })

  it('rechaza un hotel fuera de su zona con HOTEL_OUT_OF_ZONE', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelAjeno = await hotelInZone(otraZona.id)
    const gg = await generalManager(hotelAjeno)
    const draft = await requisitions.create({ hotelId: hotelAjeno, positions: positions() }, gg)
    created.push(draft.id)

    const user = await inspector([suZona.id])

    await expect(requisitions.authorize(draft.id, user)).rejects.toMatchObject({
      response: { code: 'HOTEL_OUT_OF_ZONE' },
    })
  })
})
