import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { MeService } from '../../src/modules/personal/me/me.service.js'
import { TaxDeadlineService } from '../../src/modules/personal/me/tax-deadline.service.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'
import { WorkersService } from '../../src/modules/personal/workers/workers.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Colaborador ve SU historia del semáforo y solo la suya: la ruta no lleva
 * `:id`, sale del token (RR-C-01).
 *
 * Los servicios se arman a mano sobre el cliente compartido; levantar el
 * AppModule abriría un segundo pool de conexiones.
 */

const prisma = db as unknown as PrismaService
// La historia no toca el bucket; el storage va como doble para no abrir un
// cliente de Cloud Storage en las pruebas.
const workers = new WorkersService(
  new WorkersRepository(prisma),
  { signedUrl: (): Promise<null> => Promise.resolve(null) } as never,
  new PermissionsService(prisma),
)
const me = new MeService(prisma, workers, new TaxDeadlineService(prisma))

let actorId: string
let zoneId: string
let whiteId: string
let greenId: string

const users: string[] = []
const workerIds: string[] = []

async function colaborador(email: string): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
  const user = await db.user.create({
    data: { id: uuidv7(), email, fullName: email, roleId: role.id },
    select: { id: true },
  })

  users.push(user.id)

  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      userId: user.id,
      fullName: email,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: whiteId,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
    select: { id: true },
  })

  workerIds.push(worker.id)

  return { id: user.id, roleCode: 'ROL-C-01' } as AuthenticatedUser
}

async function transicion(workerId: string): Promise<void> {
  await db.workerStateHistory.create({
    data: {
      id: uuidv7(),
      workerId,
      fromStateId: whiteId,
      toStateId: greenId,
      statusLightCode: 'WORKER',
      userId: actorId,
    },
  })
}

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  whiteId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'WHITE', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
  greenId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.workerStateHistory.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await close()
})

describe('la historia propia del Colaborador', () => {
  it('sin transiciones devuelve una lista vacía, no 404', async () => {
    const user = await colaborador(`hist-vacia-${Date.now()}@oranje.local`)

    await expect(me.history(user)).resolves.toEqual([])
  })

  it('devuelve la suya con la forma de /workers/:id/history', async () => {
    const user = await colaborador(`hist-propia-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await transicion(workerId)

    const rows = await me.history(user)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ fromState: 'WHITE', toState: 'STRONG_GREEN' })
    expect(typeof rows[0]?.occurredAt).toBe('string')
    expect(rows[0]?.userName).toBeTruthy()
  })

  it('no ve la de otro colaborador', async () => {
    const ajeno = await colaborador(`hist-ajena-${Date.now()}@oranje.local`)
    const ajenoWorkerId = workerIds[workerIds.length - 1] as string

    await transicion(ajenoWorkerId)
    await transicion(ajenoWorkerId)

    const propio = await colaborador(`hist-mia-${Date.now()}@oranje.local`)

    expect(await me.history(propio)).toEqual([])
    expect(await me.history(ajeno)).toHaveLength(2)
  })

  it('una cuenta sin colaborador ligado no tiene historia que ver', async () => {
    const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
    const suelto = await db.user.create({
      data: {
        id: uuidv7(),
        email: `suelto-${Date.now()}@oranje.local`,
        fullName: 'Suelto',
        roleId: role.id,
      },
      select: { id: true },
    })

    users.push(suelto.id)

    await expect(
      me.history({ id: suelto.id, roleCode: 'ROL-C-01' } as AuthenticatedUser),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_LINKED' } })
  })
})
