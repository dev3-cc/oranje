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
 * Morado · Eliminada. Eliminar es una TRANSICIÓN, no un `DELETE`: la
 * requisición es historia del hotel y su timeline vive en
 * `requisition_state_history`.
 *
 * Quién puede es más estrecho que el rol: el borrador solo lo quita su creador
 * o el Manager General. Eso cruza filas y no cabe en la tabla de transiciones.
 */

const prisma = db as unknown as PrismaService
// Ni Places ni el bucket hacen falta aquí: la foto va como doble para no abrir
// clientes de Google en las pruebas.
const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  new PermissionsService(prisma),
  new PlacesService({ get: () => undefined } as never),
  { signedUrl: (): Promise<null> => Promise.resolve(null) } as never,
)

let hotelId: string
let zoneId: string
let departmentId: string
let positionId: string
let modalityId: string

const created: string[] = []
const users: string[] = []
const hotels: string[] = []

async function usuario(roleCode: string, etiqueta: string): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `${etiqueta}-${Date.now()}@oranje.local`,
      fullName: etiqueta,
      roleId: role.id,
      hotelId,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode, hotelId, departmentId: null }
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

async function estado(id: string): Promise<string> {
  const row = await db.requisition.findUniqueOrThrow({
    where: { id },
    select: { statusState: { select: { code: true } } },
  })

  return row.statusState.code
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
      name: `Hotel Morado ${Date.now()}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })

  hotels.push(hotel.id)
  hotelId = hotel.id
})

afterAll(async () => {
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId: { in: created } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: created } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: created } } })
  await db.requisition.deleteMany({ where: { id: { in: created } } })

  // Los usuarios apuntan al hotel, así que van primero. Y el journal es
  // inmutable (RR-16) y retiene al actor: al que dejó rastro se le desactiva.
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

describe('el borrador lo quita quien lo escribió', () => {
  it('su creador lo elimina, y la fila sigue ahí en Morado', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-crea')
    const id = await requisicion(supervisor)

    const entity = await requisitions.remove(id, null, supervisor)

    expect(entity.state.code).toBe('PURPLE')
    expect(await estado(id)).toBe('PURPLE')

    const historia = await db.requisitionStateHistory.count({ where: { requisitionId: id } })
    expect(historia).toBeGreaterThan(0)
  })

  it('otro Supervisor del mismo hotel NO lo puede quitar', async () => {
    const suyo = await usuario('ROL-H-01', 'sup-dueno')
    const ajeno = await usuario('ROL-H-01', 'sup-ajeno')
    const id = await requisicion(suyo)

    await expect(requisitions.remove(id, null, ajeno)).rejects.toMatchObject({
      response: { code: 'NOT_YOUR_DRAFT' },
    })
  })

  it('el Manager General sí, aunque no lo haya escrito', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-otro')
    const gm = await usuario('ROL-H-03', 'gm-borra')
    const id = await requisicion(supervisor)

    await expect(requisitions.remove(id, null, gm)).resolves.toMatchObject({
      state: { code: 'PURPLE' },
    })
  })

  it('el borrador no exige motivo', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-sin-motivo')
    const id = await requisicion(supervisor)

    await expect(requisitions.remove(id, null, supervisor)).resolves.toBeTruthy()
  })
})

describe('de la autorización en adelante', () => {
  it('el Manager General la elimina con motivo, y queda en el journal', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-auth')
    const gm = await usuario('ROL-H-03', 'gm-auth')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)
    expect(await estado(id)).toBe('GREEN')

    await requisitions.remove(id, 'El hotel canceló el evento', gm)

    expect(await estado(id)).toBe('PURPLE')

    const entry = await db.journalEntry.findFirst({
      where: { entityId: id, eventType: 'REQUISITION_DELETED' },
    })

    expect(entry?.payload).toMatchObject({
      fromState: 'GREEN',
      reason: 'El hotel canceló el evento',
    })
  })

  it('sin motivo no se elimina', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-nomotivo')
    const gm = await usuario('ROL-H-03', 'gm-nomotivo')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)

    await expect(requisitions.remove(id, null, gm)).rejects.toMatchObject({
      response: { code: 'REASON_REQUIRED' },
    })
  })

  it('un Supervisor no elimina lo ya autorizado, ni con motivo', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-noauth')
    const gm = await usuario('ROL-H-03', 'gm-noauth')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)

    await expect(requisitions.remove(id, 'lo que sea', supervisor)).rejects.toMatchObject({
      response: { code: 'TRANSITION_NOT_ALLOWED' },
    })
  })
})

describe('eliminar no desasigna gente en silencio', () => {
  it('con una asignación ACTIVE responde REQUISITION_HAS_ASSIGNMENTS', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-asig')
    const gm = await usuario('ROL-H-03', 'gm-asig')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)

    const slot = await db.slot.findFirstOrThrow({
      where: { position: { requisitionId: id } },
      select: { id: true },
    })
    const worker = await db.worker.findFirstOrThrow({ select: { id: true } })

    await db.$executeRaw`
      INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
      VALUES (${uuidv7()}::uuid, ${slot.id}::uuid, ${worker.id}::uuid, 'FIXED',
              daterange(current_date, NULL), 'ACTIVE', ${gm.id}::uuid)`

    await expect(requisitions.remove(id, 'ya no hace falta', gm)).rejects.toMatchObject({
      response: { code: 'REQUISITION_HAS_ASSIGNMENTS' },
    })

    await db.$executeRaw`DELETE FROM coverage.assignment WHERE slot_id = ${slot.id}::uuid`
  })
})

describe('las Moradas salen de las listas', () => {
  it('no aparecen en la cola de Reclutamiento', async () => {
    const supervisor = await usuario('ROL-H-01', 'sup-cola')
    const gm = await usuario('ROL-H-03', 'gm-cola')
    const reclutadora = await usuario('ROL-R-01', 'recl-cola')
    const id = await requisicion(supervisor)

    await requisitions.authorize(id, gm)

    const antes = await requisitions.list({ page: 1, limit: 100 } as never, reclutadora)
    expect(antes.data.some((r) => r.id === id)).toBe(true)

    await requisitions.remove(id, 'se canceló', gm)

    const despues = await requisitions.list({ page: 1, limit: 100 } as never, reclutadora)
    expect(despues.data.some((r) => r.id === id)).toBe(false)

    // Pero el enlace viejo y el journal la siguen encontrando.
    await expect(requisitions.get(id, gm)).resolves.toMatchObject({ state: { code: 'PURPLE' } })
  })
})
