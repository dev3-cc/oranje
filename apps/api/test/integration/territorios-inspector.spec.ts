import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TerritoriesRepository } from '../../src/modules/commercial/territories/territories.repository.js'
import { TerritoriesService } from '../../src/modules/commercial/territories/territories.service.js'
import type { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * `PUT /users/:id/zones` (territory:assign — BDC y Administrador) se abre al
 * Inspector el 2026-09-24: mismo endpoint que el territorio de Ventas, ahora
 * también asigna el alcance de zona del Inspector. `set()` no consulta
 * `PermissionsService`, así que un stub basta.
 */

const prisma = db as unknown as PrismaService
const permissionsStub = {} as PermissionsService

const territories = new TerritoriesService(new TerritoriesRepository(prisma), permissionsStub)

let actorId: string
const users: string[] = []

async function userWithRole(code: string): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `zonas-${uuidv7().slice(-12)}@oranje.local`,
      fullName: 'Usuario de prueba',
      roleId: role.id,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode: code, hotelId: null, departmentId: null }
}

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await db.userZone.deleteMany({ where: { userId: { in: users } } })

  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    await db.user.updateMany({ where: { id: { in: users } }, data: { isActive: false } })
  }

  await close()
})

describe('el Inspector ya tiene zonas asignables', () => {
  it('el Administrador le asigna zonas a un Inspector', async () => {
    const zones = await db.zone.findMany({ take: 2, select: { id: true } })
    const [zonaA, zonaB] = zones
    if (!zonaA || !zonaB) throw new Error('Se requieren al menos 2 zonas sembradas')

    const inspector = await userWithRole('ROL-I-01')
    const admin: AuthenticatedUser = {
      id: actorId,
      roleCode: 'ROL-ADM-01',
      hotelId: null,
      departmentId: null,
    }

    const result = await territories.set(inspector.id, { zoneIds: [zonaA.id, zonaB.id] }, admin)

    expect(result.zones.map((z) => z.id).sort()).toEqual([zonaA.id, zonaB.id].sort())
  })

  it('un rol sin zonas sigue rechazado con ROLE_WITHOUT_TERRITORY', async () => {
    const [zona] = await db.zone.findMany({ take: 1, select: { id: true } })
    if (!zona) throw new Error('Se requiere al menos 1 zona sembrada')

    const supervisor = await userWithRole('ROL-H-01')
    const admin: AuthenticatedUser = {
      id: actorId,
      roleCode: 'ROL-ADM-01',
      hotelId: null,
      departmentId: null,
    }

    await expect(
      territories.set(supervisor.id, { zoneIds: [zona.id] }, admin),
    ).rejects.toMatchObject({ response: { code: 'ROLE_WITHOUT_TERRITORY' } })
  })
})
