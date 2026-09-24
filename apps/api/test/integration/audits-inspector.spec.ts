import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { AuditsRepository } from '../../src/modules/supervision/audits/audits.repository.js'
import { AuditsService } from '../../src/modules/supervision/audits/audits.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Inspector audita (Reglas de Negocio, 2026-09-24) igual que el
 * Supervisor, pero sin hotel fijo — acotado a los hoteles de su(s) zona(s)
 * asignada(s), mismo criterio que Requisiciones.
 */

const prisma = db as unknown as PrismaService
const storageFake = {
  signedUrl: (path: string): Promise<string> => Promise.resolve(`https://firmada.local/${path}`),
}

const audits = new AuditsService(
  new AuditsRepository(prisma),
  storageFake as unknown as StorageService,
)

let actorId: string
let envItem: string

const users: string[] = []
const hotels: string[] = []
const auditIds: string[] = []
const checklistItemIds: string[] = []

async function hotelInZone(zoneId: string): Promise<string> {
  const id = uuidv7()

  await db.hotel.create({
    data: {
      id,
      name: `Hotel Auditoría Zona ${id.slice(-8)}`,
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
      email: `audit-inspector-${uuidv7().slice(-12)}@oranje.local`,
      fullName: 'Inspector auditor',
      roleId: role.id,
    },
    select: { id: true },
  })

  users.push(user.id)

  await db.userZone.createMany({ data: zoneIds.map((zoneId) => ({ userId: user.id, zoneId })) })

  return { id: user.id, roleCode: 'ROL-I-01', hotelId: null, departmentId: null }
}

beforeAll(async () => {
  actorId = (await actor()).id

  const id = uuidv7()
  await db.auditChecklistItem.create({
    data: {
      id,
      auditType: 'ENVIRONMENT',
      category: 'Insumos',
      code: `TEST_INSPECTOR_${id.slice(-12)}`,
      label: 'Item de prueba del Inspector',
      weight: 1,
      ordinal: 1,
    },
  })
  checklistItemIds.push(id)
  envItem = id
})

afterAll(async () => {
  await db.auditResponseHistory.deleteMany({
    where: { auditResponse: { auditId: { in: auditIds } } },
  })
  await db.auditResponse.deleteMany({ where: { auditId: { in: auditIds } } })
  await db.audit.deleteMany({ where: { id: { in: auditIds } } })
  await db.auditChecklistItem.deleteMany({ where: { id: { in: checklistItemIds } } })
  await db.userZone.deleteMany({ where: { userId: { in: users } } })

  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    await db.user.updateMany({ where: { id: { in: users } }, data: { isActive: false } })
  }

  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('el Inspector audita hoteles de su zona', () => {
  it('crea una auditoría de un hotel de su zona', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelId = await hotelInZone(suZona.id)
    const user = await inspector([suZona.id, otraZona.id])

    const entity = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItem, value: 'CUMPLE' }],
      },
      user,
    )
    auditIds.push(entity.id)

    expect(entity.hotel.id).toBe(hotelId)
  })

  it('rechaza un hotel fuera de sus zonas con HOTEL_OUT_OF_ZONE', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelAjeno = await hotelInZone(otraZona.id)
    const user = await inspector([suZona.id])

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId: hotelAjeno,
          responses: [{ checklistItemId: envItem, value: 'CUMPLE' }],
        },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_ZONE' } })
  })

  it('sin hotelId en la lista, ve solo las de sus zonas', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [suZona, otraZona] = zones
    if (!suZona || !otraZona) throw new Error('Se requieren al menos 2 zonas sembradas')

    const hotelDentro = await hotelInZone(suZona.id)
    const hotelFuera = await hotelInZone(otraZona.id)
    const user = await inspector([suZona.id])

    const dentro = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId: hotelDentro,
        responses: [{ checklistItemId: envItem, value: 'CUMPLE' }],
      },
      user,
    )
    auditIds.push(dentro.id)

    const otroInspector = await inspector([otraZona.id])
    const fuera = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId: hotelFuera,
        responses: [{ checklistItemId: envItem, value: 'CUMPLE' }],
      },
      otroInspector,
    )
    auditIds.push(fuera.id)

    const board = await audits.list({ page: 1, limit: 100 }, user)
    const ids = board.data.map((row) => row.id)

    expect(ids).toContain(dentro.id)
    expect(ids).not.toContain(fuera.id)
  })
})
