import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import { GoogleAuth } from 'google-auth-library'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { CPanelService } from '../../src/infra/cpanel/index.js'
import { CPanelError } from '../../src/infra/cpanel/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'
import { FirebaseAccountsService } from '../../src/modules/identity/users/firebase-accounts.service.js'
import { AccessDeadlineService } from '../../src/modules/personal/me/access-deadline.service.js'
import { WorkerAccessService } from '../../src/modules/personal/workers/worker-access.service.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'
import { WorkersService } from '../../src/modules/personal/workers/workers.service.js'

import { close, db } from './db.js'

/**
 * Reglas de Negocio § Acceso del Colaborador y § Validación con expediente
 * incompleto (Hugo, 2026-09-17).
 *
 * El alta crea el acceso completo con UNA contraseña temporal que se entrega
 * en mano (nada por correo: el buzón al que llegaría es el que se está
 * creando). Firebase y cPanel son terceros y van dobles: Firebase responde
 * el uid, y cPanel una vez falla —la cuenta de Oranje existe igual y la
 * respuesta lo dice— y otra funciona.
 */

const prisma = db as unknown as PrismaService
const permissions = new PermissionsService(prisma)
const notificationsFake = { publish: (): Promise<void> => Promise.resolve() } as never
const storageFake = { signedUrl: (): Promise<null> => Promise.resolve(null) } as never
const workers = new WorkersService(
  new WorkersRepository(prisma),
  storageFake,
  permissions,
  notificationsFake,
)
const deadlines = new AccessDeadlineService(prisma)

const fetchMock = jest.fn()
let cpanelFails = false
const cpanelFake = {
  domainName: 'oranje.local',
  createMailbox: (): Promise<void> =>
    cpanelFails
      ? Promise.reject(new CPanelError(['IP de salida no autorizada']))
      : Promise.resolve(),
} as unknown as CPanelService

let access: WorkerAccessService
let recruiter: AuthenticatedUser
let zoneId: string

const workerIds: string[] = []
const userIds: string[] = []

async function bareWorker(etiqueta: string): Promise<string> {
  const white = await db.statusLightState.findFirstOrThrow({
    where: { code: 'WHITE', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: etiqueta,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: white.id,
      statusLightCode: 'WORKER',
      createdBy: recruiter.id,
    },
    select: { id: true },
  })
  workerIds.push(worker.id)
  return worker.id
}

beforeAll(async () => {
  jest.spyOn(GoogleAuth.prototype, 'getAccessToken').mockResolvedValue('token-de-prueba')
  globalThis.fetch = fetchMock
  fetchMock.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ localId: `uid-${String(Date.now())}` }),
    }),
  )

  const config = { get: () => 'oranje-test' } as never
  access = new WorkerAccessService(prisma, new FirebaseAccountsService(config), cpanelFake)

  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-R-01' }, select: { id: true } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `recl-acceso-${String(Date.now())}@oranje.local`,
      fullName: 'Reclutadora de acceso',
      roleId: role.id,
    },
    select: { id: true },
  })
  userIds.push(user.id)
  recruiter = { id: user.id, roleCode: 'ROL-R-01', hotelId: null, departmentId: null }
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.journalEntry.deleteMany({ where: { entityId: { in: [...workerIds, ...userIds] } } })
  await db.workerStateHistory.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await close()
})

test('el acceso nace con cuenta enlazada, contraseña temporal y buzón; cPanel puede fallar sin tirar nada', async () => {
  const workerId = await bareWorker(`Acceso ${String(Date.now())}`)
  const localPart = `acceso.${String(Date.now())}`

  cpanelFails = true
  const credential = await access.create(workerId, localPart, recruiter)

  expect(credential.email).toBe(`${localPart}@oranje.local`)
  expect(credential.password).toHaveLength(16)
  expect(credential.mailbox).toEqual({ created: false, reason: 'IP de salida no autorizada' })

  const worker = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    select: {
      account: { select: { id: true, firebaseUid: true, tempPasswordIssuedAt: true, role: true } },
    },
  })
  expect(worker.account).not.toBeNull()
  userIds.push(worker.account?.id as string)
  expect(worker.account?.firebaseUid).toMatch(/^uid-/)
  expect(worker.account?.tempPasswordIssuedAt).not.toBeNull()
  expect(worker.account?.role.code).toBe('ROL-C-01')

  // La contraseña JAMÁS va al journal.
  const journal = await db.journalEntry.findFirst({
    where: { entityId: workerId, eventType: 'WORKER_ACCESS_CREATED' },
    select: { payload: true },
  })
  expect(JSON.stringify(journal?.payload)).not.toContain(credential.password)

  // Un segundo acceso para el mismo colaborador no procede.
  await expect(access.create(workerId, `otro.${localPart}`, recruiter)).rejects.toBeInstanceOf(
    ConflictException,
  )

  // El plazo de la contraseña corre desde hoy: día 1, pendiente.
  const before = await deadlines.of(worker.account?.id as string)
  expect(before.password).toMatchObject({ status: 'PENDING', day: 1 })

  // Cuatro días después, vencido; con la contraseña cambiada, nada que cobrar.
  const issuedAt = new Date(Date.now() - 4 * 86_400_000)
  const overdue = await deadlines.of(
    worker.account?.id as string,
    new Date(issuedAt.getTime() + 4 * 86_400_000),
  )
  expect(overdue.password.status).toBe('PENDING')
  await db.user.update({
    where: { id: worker.account?.id as string },
    data: { tempPasswordIssuedAt: issuedAt },
  })
  expect((await deadlines.of(worker.account?.id as string)).password.status).toBe('OVERDUE')
  expect(await deadlines.overdueOf(worker.account?.id as string)).toEqual(['PASSWORD'])
  await db.user.update({
    where: { id: worker.account?.id as string },
    data: { tempPasswordIssuedAt: null },
  })
  deadlines.invalidate(worker.account?.id as string)
  expect((await deadlines.of(worker.account?.id as string)).password.status).toBe('NONE')
})

test('con cPanel sano el buzón se crea y la respuesta lo dice', async () => {
  const workerId = await bareWorker(`Buzon ${String(Date.now())}`)
  cpanelFails = false

  const credential = await access.create(workerId, `buzon.${String(Date.now())}`, recruiter)
  const account = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    select: { userId: true },
  })
  userIds.push(account.userId as string)

  expect(credential.mailbox).toEqual({ created: true })
})

test('validar con el expediente a medias exige confirmarlo y abre 3 días para completarlo', async () => {
  const workerId = await bareWorker(`Incompleto ${String(Date.now())}`)

  // Sin confirmar, sigue siendo lo de siempre.
  await expect(
    workers.changeState(workerId, { toState: 'STRONG_GREEN' }, recruiter),
  ).rejects.toMatchObject({ response: { code: 'PROFILE_INCOMPLETE' } })
  await expect(
    workers.changeState(workerId, { toState: 'STRONG_GREEN' }, recruiter),
  ).rejects.toBeInstanceOf(UnprocessableEntityException)

  // Confirmado pero con la Fase 1 a medias tampoco: eso no lo puede llenar el
  // colaborador, y el plazo no estaría en su mano.
  await expect(
    workers.changeState(
      workerId,
      { toState: 'STRONG_GREEN', acceptIncompleteProfile: true },
      recruiter,
    ),
  ).rejects.toMatchObject({ response: { code: 'PROFILE_PHASE1_INCOMPLETE' } })

  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const english = await db.englishLevel.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  await db.worker.update({
    where: { id: workerId },
    data: {
      catalogPositionId: position.id,
      englishLevelId: english.id,
      hiringModalityId: modality.id,
      experienceLevel: 'NONE',
    },
  })

  const validated = await workers.changeState(
    workerId,
    { toState: 'STRONG_GREEN', acceptIncompleteProfile: true },
    recruiter,
  )

  expect(validated.state.code).toBe('STRONG_GREEN')
  expect(validated.isProfileComplete).toBe(false)
  const dueAt = new Date(validated.profileDueAt as string)
  expect(dueAt.getTime() - Date.now()).toBeGreaterThan(2.9 * 86_400_000)
  expect(dueAt.getTime() - Date.now()).toBeLessThan(3.1 * 86_400_000)

  // El plazo lo ve el colaborador en su ficha (por su cuenta), y se levanta
  // solo al completar el expediente: no hay nada que limpiar.
  const credential = await access.create(workerId, `incompleto.${String(Date.now())}`, recruiter)
  const account = await db.worker.findUniqueOrThrow({
    where: { id: workerId },
    select: { userId: true },
  })
  userIds.push(account.userId as string)
  expect(credential.email).toContain('incompleto.')

  expect((await deadlines.of(account.userId as string)).profile).toMatchObject({
    status: 'PENDING',
    day: 1,
  })

  await db.worker.update({
    where: { id: workerId },
    data: { profileDueAt: new Date(Date.now() - 86_400_000) },
  })
  expect((await deadlines.of(account.userId as string)).profile.status).toBe('OVERDUE')

  await db.worker.update({
    where: { id: workerId },
    data: {
      transportType: 'PUBLIC',
      emergencyContactName: 'Mamá',
      emergencyContactPhone: '9991112222',
      emergencyContactRelationship: 'MOTHER',
      bloodType: 'O_POS',
    },
  })
  expect((await deadlines.of(account.userId as string)).profile.status).toBe('NONE')
})
