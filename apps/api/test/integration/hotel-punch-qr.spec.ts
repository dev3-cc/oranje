import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { HotelsRepository } from '../../src/modules/commercial/hotels/hotels.repository.js'
import { HotelsService } from '../../src/modules/commercial/hotels/hotels.service.js'
import { parsePunchQrPayload } from '../../src/modules/commercial/hotels/punch-qr.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El QR de ponche del hotel (Reglas de Negocio, «Método de ponche por hotel»):
 * nace al pasar a QR, se imprime desde su payload, y regenerar invalida el
 * anterior sin tocar nada más.
 */

const prisma = db as unknown as PrismaService
const config = { get: () => undefined }
const hotels = new HotelsService(
  new HotelsRepository(prisma),
  new PlacesService(config as never),
  prisma,
)

const created: string[] = []
let actorId: string
let zoneId: string

async function hotel(): Promise<string> {
  const id = uuidv7()
  await db.hotel.create({
    data: {
      id,
      name: `Hotel QR ${id.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
  created.push(id)
  return id
}

const bd = (): AuthenticatedUser =>
  ({ id: actorId, roleCode: 'ROL-V-01', hotelId: null }) as unknown as AuthenticatedUser

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.journalEntry.deleteMany({ where: { entityId: { in: created } } })
  await db.hotel.deleteMany({ where: { id: { in: created } } })
  await close()
})

describe('QR de ponche del hotel', () => {
  it('un hotel nace en Selfie, sin QR, y no tiene nada que imprimir', async () => {
    const id = await hotel()
    const entity = await hotels.get(id)

    expect(entity.punchMethod).toBe('SELFIE')
    expect(entity.punchQr).toBeNull()
    await expect(hotels.punchQr(id)).rejects.toMatchObject({
      response: { code: 'PUNCH_METHOD_NOT_QR' },
    })
  })

  it('pasar a QR genera el primer código, y el payload lleva al hotel', async () => {
    const id = await hotel()
    const entity = await hotels.update(id, { punchMethod: 'QR' }, actorId)

    expect(entity.punchMethod).toBe('QR')
    expect(entity.punchQr?.version).toBe(1)

    const qr = await hotels.punchQr(id)
    const parsed = parsePunchQrPayload(qr.payload)
    expect(parsed?.hotelId).toBe(id)
    expect(parsed?.secret).toHaveLength(32)
    // El secreto no se filtra por la entidad: solo viaja dentro del payload.
    expect(JSON.stringify(entity)).not.toContain(parsed?.secret)
  })

  it('regenerar sube la versión e invalida el payload anterior', async () => {
    const id = await hotel()
    await hotels.update(id, { punchMethod: 'QR' }, actorId)
    const before = await hotels.punchQr(id)

    const after = await hotels.regeneratePunchQr(id, bd())

    expect(after.version).toBe(2)
    expect(after.payload).not.toBe(before.payload)
    const journal = await db.journalEntry.findMany({
      where: { entityId: id, eventType: 'HOTEL_PUNCH_QR_REGENERATED' },
    })
    expect(journal).toHaveLength(1)
  })

  it('volver a Selfie conserva el código: si regresa a QR no cambia de versión', async () => {
    const id = await hotel()
    await hotels.update(id, { punchMethod: 'QR' }, actorId)
    await hotels.update(id, { punchMethod: 'SELFIE' }, actorId)
    const back = await hotels.update(id, { punchMethod: 'QR' }, actorId)

    expect(back.punchQr?.version).toBe(1)
  })
})
