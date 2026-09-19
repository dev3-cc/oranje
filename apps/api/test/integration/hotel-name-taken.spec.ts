import { ConflictException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { HotelsRepository } from '../../src/modules/commercial/hotels/hotels.repository.js'
import { HotelsService } from '../../src/modules/commercial/hotels/hotels.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Editar un hotel sin tocar el nombre (o guardando el mismo, tal cual vuelve
 * del formulario) NO debe chocar contra sí mismo — reportado por Hugo: al
 * editar «Fairfield by Marriott…» sin cambiar nada, `assertNameAvailable`
 * se comparaba contra sí mismo y devolvía HOTEL_NAME_TAKEN falso.
 */

const prisma = db as unknown as PrismaService
const config = { get: () => undefined }
const hotels = new HotelsService(
  new HotelsRepository(prisma),
  new PlacesService(config as never),
  prisma,
  { publish: (): Promise<void> => Promise.resolve() } as never,
)

const created: string[] = []
let actorId: string
let zoneId: string

async function hotel(name: string): Promise<string> {
  const id = uuidv7()
  await db.hotel.create({
    data: { id, name, zoneId, timeZone: 'America/Cancun', createdBy: actorId, updatedBy: actorId },
  })
  created.push(id)
  return id
}

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.journalEntry.deleteMany({ where: { entityId: { in: created } } })
  await db.hotel.deleteMany({ where: { id: { in: created } } })
  await close()
})

test('guardar un hotel con su propio nombre no choca contra sí mismo', async () => {
  const stamp = Date.now()
  const id = await hotel(`Hotel Editar Prueba ${String(stamp)}`)

  const updated = await hotels.update(id, { name: `Hotel Editar Prueba ${String(stamp)}` }, actorId)
  expect(updated.name).toBe(`Hotel Editar Prueba ${String(stamp)}`)
})

test('renombrarlo a un nombre distinto pero libre también funciona', async () => {
  const stamp = Date.now()
  const id = await hotel(`Hotel Original ${String(stamp)}`)

  const updated = await hotels.update(id, { name: `Hotel Renombrado ${String(stamp)}` }, actorId)
  expect(updated.name).toBe(`Hotel Renombrado ${String(stamp)}`)
})

test('renombrarlo al nombre de OTRO hotel sí choca: 409 HOTEL_NAME_TAKEN', async () => {
  const stamp = Date.now()
  await hotel(`Hotel A ${String(stamp)}`)
  const idB = await hotel(`Hotel B ${String(stamp)}`)

  await expect(hotels.update(idB, { name: `Hotel A ${String(stamp)}` }, actorId)).rejects.toThrow(
    ConflictException,
  )
})
