import { v7 as uuidv7 } from 'uuid'

import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js'
import { PushService } from '../../src/modules/notifications/push.service.js'
import { RecipientsService } from '../../src/modules/notifications/recipients.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Quien disparó el evento con su acción (Hugo, 2026-09-15): `list()` y
 * `markRead()` deben devolverlo con su foto YA firmada, no solo el id crudo.
 */

const prisma = db as unknown as PrismaService
const storage = {
  signedUrl: (path: string) => Promise.resolve(`https://example.test/${path}`),
} as unknown as StorageService
const configStub = { get: () => undefined } as unknown as ConstructorParameters<
  typeof PushService
>[1]
const notifications = new NotificationsService(
  prisma,
  new RecipientsService(prisma),
  new PushService(prisma, configStub),
  storage,
)

let recipientId: string
let actorId: string
let typeId: string
const notificationIds: string[] = []
const userIds: string[] = []

async function newUser(email: string, photoPath: string | null): Promise<string> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
  const user = await db.user.create({
    data: { id: uuidv7(), email, fullName: email, roleId: role.id, photoPath },
    select: { id: true },
  })
  userIds.push(user.id)
  return user.id
}

beforeAll(async () => {
  recipientId = (await actor()).id
  actorId = await newUser(`actor-${Date.now()}@oranje.local`, 'users/photo/prueba.jpg')
  typeId = (await db.notificationType.findFirstOrThrow({ where: { code: 'REQ_AUTHORIZED' } })).id
})

afterAll(async () => {
  await db.notification.deleteMany({ where: { id: { in: notificationIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await close()
})

test('list() trae al actor con su foto firmada', async () => {
  const id = uuidv7()
  await db.notification.create({
    data: {
      id,
      userId: recipientId,
      notificationTypeId: typeId,
      title: 'Requisición autorizada',
      body: 'TD-1 ya está autorizada',
      actorUserId: actorId,
    },
  })
  notificationIds.push(id)

  const board = await notifications.list(recipientId, { page: 1, limit: 50, unreadOnly: false })
  const row = board.data.find((item) => item.id === id)

  expect(row?.actor?.id).toBe(actorId)
  expect(row?.actor?.fullName).toContain('actor-')
  expect(row?.actor?.photoUrl).toBe('https://example.test/users/photo/prueba.jpg')
})

test('sin actor (avisos de sistema), la fila trae actor null', async () => {
  const id = uuidv7()
  await db.notification.create({
    data: {
      id,
      userId: recipientId,
      notificationTypeId: typeId,
      title: 'Aviso del sistema',
      body: 'Sin actor humano',
    },
  })
  notificationIds.push(id)

  const row = await notifications.markRead(recipientId, id)
  expect(row.actor).toBeNull()
})
