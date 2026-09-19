import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { PrismaService } from '../../src/infra/prisma/index.js'
import {
  createCatalogItemSchema,
  updateCatalogItemSchema,
} from '../../src/modules/catalogs/manage/dto/manage-catalog.dto.js'
import { ManageCatalogsService } from '../../src/modules/catalogs/manage/manage-catalogs.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El CRUD de catálogos del Administrador. Lo que fija el contrato:
 * el código se DERIVA del nombre (nadie lo manda), el duplicado lo decide el
 * único de `code` en la base (P2002 → 409), una posición exige departamento,
 * y el DELETE es real pero la FK protege lo que está en uso (P2003 → 409) —
 * el mismo criterio que borró a mano habría violado en silencio.
 */

const stamp = Date.now()
let service: ManageCatalogsService
let auth: { id: string; roleCode: string; hotelId: null; departmentId: null }

/** Filas creadas por el spec, para dejar la base como estaba. */
const cleanup: Array<{
  table:
    | 'hiringModality'
    | 'catalogPosition'
    | 'hotelDepartment'
    | 'zone'
    | 'statusChangeReason'
    | 'hotel'
  id: string
}> = []

beforeAll(async () => {
  service = new ManageCatalogsService(db as unknown as PrismaService)
  const user = await actor()
  auth = { id: user.id, roleCode: 'ROL-ADM-01', hotelId: null, departmentId: null }
})

afterAll(async () => {
  for (const row of cleanup.reverse()) {
    await (db[row.table] as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({
      where: { id: row.id },
    })
  }
  await db.journalEntry.deleteMany({
    where: { entityType: { startsWith: 'catalogs.' }, actorUserId: auth.id },
  })
  await close()
})

test('crear deriva el código del nombre y deja journal', async () => {
  const dto = createCatalogItemSchema.parse({ name: `Por Obra ${String(stamp)}` })
  const row = await service.create('hiring-modalities', dto, auth)
  cleanup.push({ table: 'hiringModality', id: row.id })

  expect(row.code).toBe(`POR_OBRA_${String(stamp)}`)

  const journal = await db.journalEntry.findMany({
    where: { entityType: 'catalogs.hiring-modalities', entityId: row.id },
    select: { eventType: true },
  })
  expect(journal.map((entry) => entry.eventType)).toContain('CATALOG_ITEM_CREATED')
})

test('el nombre repetido choca por código: 409 CATALOG_NAME_TAKEN', async () => {
  const dto = createCatalogItemSchema.parse({ name: `Repetida ${String(stamp)}` })
  const row = await service.create('hiring-modalities', dto, auth)
  cleanup.push({ table: 'hiringModality', id: row.id })

  // Mismo nombre con otras mayúsculas: mismo código, mismo choque.
  const again = createCatalogItemSchema.parse({ name: `REPETIDA ${String(stamp)}` })
  await expect(service.create('hiring-modalities', again, auth)).rejects.toThrow(ConflictException)
})

test('una posición sin departamento no es una posición', async () => {
  const dto = createCatalogItemSchema.parse({ name: `Sin Depto ${String(stamp)}` })
  await expect(service.create('positions', dto, auth)).rejects.toThrow(UnprocessableEntityException)
})

test('crear posición con departamento, renombrarla y eliminarla', async () => {
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })

  const dto = createCatalogItemSchema.parse({
    name: `Valet ${String(stamp)}`,
    hotelDepartmentId: department.id,
  })
  const row = await service.create('positions', dto, auth)
  cleanup.push({ table: 'catalogPosition', id: row.id })

  const renamed = await service.update(
    'positions',
    row.id,
    updateCatalogItemSchema.parse({ name: `Valet Nocturno ${String(stamp)}` }),
    auth,
  )
  // El código sigue al nombre: identificador derivado, no historia.
  expect(renamed.code).toBe(`VALET_NOCTURNO_${String(stamp)}`)

  await service.remove('positions', row.id, auth)
  const gone = await db.catalogPosition.findUnique({ where: { id: row.id } })
  expect(gone).toBeNull()
})

test('un departamento con posiciones colgando no se elimina: 409 CATALOG_IN_USE', async () => {
  // Housekeeping (o el que sea) tiene posiciones del seed: la FK lo protege.
  const inUse = await db.catalogPosition.findFirstOrThrow({
    select: { hotelDepartmentId: true },
  })
  await expect(service.remove('hotel-departments', inUse.hotelDepartmentId, auth)).rejects.toThrow(
    ConflictException,
  )
})

test('un catálogo desconocido es 404, y los semáforos NO se administran desde aquí', () => {
  expect(() => {
    service.assertManaged('status-lights')
  }).toThrow(NotFoundException)
})

test('crear zona, renombrarla y eliminarla', async () => {
  const dto = createCatalogItemSchema.parse({ name: `Riviera Prueba ${String(stamp)}` })
  const row = await service.create('zones', dto, auth)
  cleanup.push({ table: 'zone', id: row.id })

  const renamed = await service.update(
    'zones',
    row.id,
    updateCatalogItemSchema.parse({ name: `Riviera Renombrada ${String(stamp)}` }),
    auth,
  )
  expect(renamed.code).toBe(`RIVIERA_RENOMBRADA_${String(stamp)}`)

  await service.remove('zones', row.id, auth)
  const gone = await db.zone.findUnique({ where: { id: row.id } })
  expect(gone).toBeNull()
})

test('una zona con un hotel colgando no se elimina: 409 CATALOG_IN_USE', async () => {
  // Un hotel propio, no uno que ya exista: en CI la base nace sin ninguno.
  const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
  const hotelId = uuidv7()
  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Catálogos ${String(stamp)}`,
      zoneId: zone.id,
      timeZone: 'America/Cancun',
    },
  })
  cleanup.push({ table: 'hotel', id: hotelId })

  await expect(service.remove('zones', zone.id, auth)).rejects.toThrow(ConflictException)
})

test('un motivo sin semáforo no es un motivo', async () => {
  const dto = createCatalogItemSchema.parse({ name: `Motivo Suelto ${String(stamp)}` })
  await expect(service.create('reasons', dto, auth)).rejects.toThrow(UnprocessableEntityException)
})

test('un semáforo que no existe: 422 STATUS_LIGHT_UNKNOWN', async () => {
  const dto = createCatalogItemSchema.parse({
    name: `Motivo Fantasma ${String(stamp)}`,
    statusLightCode: 'NO_EXISTE',
  })
  await expect(service.create('reasons', dto, auth)).rejects.toThrow(UnprocessableEntityException)
})

test('crear motivo con semáforo, renombrarlo y eliminarlo', async () => {
  const dto = createCatalogItemSchema.parse({
    name: `Se mudó ${String(stamp)}`,
    statusLightCode: 'WORKER',
  })
  const row = await service.create('reasons', dto, auth)
  cleanup.push({ table: 'statusChangeReason', id: row.id })

  const renamed = await service.update(
    'reasons',
    row.id,
    updateCatalogItemSchema.parse({ name: `Cambió de ciudad ${String(stamp)}` }),
    auth,
  )
  expect(renamed.code).toBe(`CAMBIO_DE_CIUDAD_${String(stamp)}`)

  await service.remove('reasons', row.id, auth)
  const gone = await db.statusChangeReason.findUnique({ where: { id: row.id } })
  expect(gone).toBeNull()
})
