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
 * La tarjeta de la requisición pinta la foto del hotel y la de quien la pidió.
 *
 * Son dos mecanismos distintos y por eso se prueban juntos: la del hotel se
 * COMPONE desde `photo_ref` (el binario es de Google, D-34) y la del creador se
 * FIRMA desde `photo_path` (el binario es nuestro, D-30).
 */

const prisma = db as unknown as PrismaService
const places = new PlacesService({
  get: (k: string) => (k === 'GOOGLE_MAPS_BROWSER_KEY' ? 'llave-de-prueba' : undefined),
} as never)
const storage = {
  signedUrl: (path: string): Promise<string> => Promise.resolve(`https://firmada.test/${path}`),
} as never

const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  new PermissionsService(prisma),
  places,
  storage,
)

let departmentId: string
let positionId: string
let modalityId: string
let zoneId: string

const created: string[] = []
const users: string[] = []
const hotels: string[] = []

async function hotel(photoRef: string | null): Promise<string> {
  const actorId = (await actor()).id
  const id = uuidv7()

  await db.hotel.create({
    data: {
      id,
      name: `Hotel Foto ${id.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      photoRef,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })

  hotels.push(id)

  return id
}

async function supervisor(hotelId: string, photoPath: string | null): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-H-01' } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `req-foto-${uuidv7().slice(-12)}@oranje.local`,
      fullName: 'Supervisor con foto',
      roleId: role.id,
      hotelId,
      photoPath,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode: 'ROL-H-01', hotelId, departmentId: null }
}

async function requisicion(user: AuthenticatedUser, hotelId: string): Promise<string> {
  const entity = await requisitions.create(
    {
      hotelId,
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

  created.push(entity.id)

  return entity.id
}

beforeAll(async () => {
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId: { in: created } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: created } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: created } } })
  await db.requisition.deleteMany({ where: { id: { in: created } } })

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

describe('la requisición trae la foto del hotel y quién la pidió', () => {
  it('con foto en el hotel y en el creador, las dos salen', async () => {
    const hotelId = await hotel('places/ChIJabc/photos/AXYZ')
    const user = await supervisor(hotelId, 'users/photo/sup.webp')
    const id = await requisicion(user, hotelId)

    const board = await requisitions.list({ page: 1, limit: 100 } as never, user)
    const row = board.data.find((r) => r.id === id)

    expect(row?.hotel.photoUrl).toContain('places/ChIJabc/photos/AXYZ/media')
    expect(row?.createdBy?.id).toBe(user.id)
    expect(row?.createdBy?.fullName).toBe('Supervisor con foto')
    expect(row?.createdBy?.photoUrl).toBe('https://firmada.test/users/photo/sup.webp')
  })

  it('un hotel sin photo_ref da photoUrl null, no rompe', async () => {
    const hotelId = await hotel(null)
    const user = await supervisor(hotelId, null)
    const id = await requisicion(user, hotelId)

    const board = await requisitions.list({ page: 1, limit: 100 } as never, user)
    const row = board.data.find((r) => r.id === id)

    expect(row?.hotel.photoUrl).toBeNull()
    expect(row?.createdBy?.photoUrl).toBeNull()
    // Sin foto, el creador sigue estando: lo que falta es la imagen, no la persona.
    expect(row?.createdBy?.fullName).toBe('Supervisor con foto')
  })

  it('la ficha suelta trae lo mismo que la lista', async () => {
    const hotelId = await hotel('places/ChIJdef/photos/AQRS')
    const user = await supervisor(hotelId, 'users/photo/otro.webp')
    const id = await requisicion(user, hotelId)

    const row = await requisitions.get(id, user)

    expect(row.hotel.photoUrl).toContain('places/ChIJdef/photos/AQRS/media')
    expect(row.createdBy?.photoUrl).toBe('https://firmada.test/users/photo/otro.webp')
  })
})
