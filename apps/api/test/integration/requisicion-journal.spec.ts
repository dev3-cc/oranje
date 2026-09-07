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
 * `GET /:id/journal` — sin permiso propio: reutiliza EXACTAMENTE el criterio
 * de lectura de `get()` (RequisitionsService.get). Si un rol puede leer la
 * requisición, puede leer su bitácora; si no, ni sabe que existe.
 */

const prisma = db as unknown as PrismaService
const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  new PermissionsService(prisma),
  new PlacesService({ get: () => undefined } as never),
  { signedUrl: (): Promise<null> => Promise.resolve(null) } as never,
)

let hotelId: string
let otherHotelId: string
let zoneId: string
let departmentId: string
let positionId: string
let modalityId: string

const created: string[] = []
const users: string[] = []
const hotels: string[] = []

async function usuario(
  roleCode: string,
  etiqueta: string,
  scopeHotelId: string | null = hotelId,
): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `${etiqueta}-${Date.now()}@oranje.local`,
      fullName: etiqueta,
      roleId: role.id,
      hotelId: scopeHotelId,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode, hotelId: scopeHotelId, departmentId: null }
}

async function requisicion(user: AuthenticatedUser): Promise<string> {
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
  const actorId = (await actor()).id

  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel Bitácora ${Date.now()}`,
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
      name: `Hotel Ajeno ${Date.now()}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })

  hotels.push(hotel.id, other.id)
  hotelId = hotel.id
  otherHotelId = other.id
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

describe('quien puede leer la requisición puede leer su bitácora', () => {
  it('el creador ve los eventos reales, del más reciente al más viejo, con el nombre del actor', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-bitacora')
    const gm = await usuario('ROL-H-03', 'gm-bitacora')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)

    const journal = await requisitions.journal(id, supervisor)

    expect(journal.length).toBeGreaterThanOrEqual(2)
    expect(journal.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(['REQUISITION_CREATED', 'REQUISITION_AUTHORIZED']),
    )

    // Desc: el más reciente (autorizar) antes que el más viejo (crear).
    const createdIdx = journal.findIndex((e) => e.eventType === 'REQUISITION_CREATED')
    const authorizedIdx = journal.findIndex((e) => e.eventType === 'REQUISITION_AUTHORIZED')
    expect(authorizedIdx).toBeLessThan(createdIdx)

    const creado = journal.find((e) => e.eventType === 'REQUISITION_CREATED')
    expect(creado?.actorName).toBe('sup-bitacora')
    expect(creado?.actorRole).toBe('ROL-H-01')
    expect(creado?.payload).toMatchObject({ positions: 1 })

    const autorizado = journal.find((e) => e.eventType === 'REQUISITION_AUTHORIZED')
    expect(autorizado?.actorName).toBe('gm-bitacora')
  })

  it('la Reclutadora (cola de autorizadas) también la lee', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-recl-bitacora')
    const gm = await usuario('ROL-H-03', 'gm-recl-bitacora')
    const reclutadora = await usuario('ROL-R-01', 'recl-bitacora')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)

    await expect(requisitions.journal(id, reclutadora)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: 'REQUISITION_CREATED' })]),
    )
  })

  it('un Supervisor de OTRO hotel no puede leer la bitácora', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-dueno-bitacora')
    const ajeno = await usuario('ROL-H-01', 'sup-ajeno-bitacora', otherHotelId)
    const id = await requisicion(supervisor)

    await expect(requisitions.journal(id, ajeno)).rejects.toMatchObject({
      response: { code: 'HOTEL_OUT_OF_SCOPE' },
    })
  })

  it('un rol sin ninguno de los tres permisos de lectura recibe FORBIDDEN', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-bd-bitacora')
    const bd = await usuario('ROL-V-01', 'bd-bitacora', null)
    const id = await requisicion(supervisor)

    await expect(requisitions.journal(id, bd)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    })
  })

  it('la Reclutadora no ve la bitácora de un borrador (la cola no incluye borradores)', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-borrador-bitacora')
    const reclutadora = await usuario('ROL-R-01', 'recl-borrador-bitacora')
    const id = await requisicion(supervisor)

    await expect(requisitions.journal(id, reclutadora)).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    })
  })

  it('una requisición que no existe da 404, igual que `get()`', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-404-bitacora')

    await expect(requisitions.journal(uuidv7(), supervisor)).rejects.toMatchObject({
      response: { code: 'REQUISITION_NOT_FOUND' },
    })
  })
})
