import { v7 as uuidv7 } from 'uuid'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Lo que protege este archivo es que nadie reciba dos veces el mismo aviso ni
 * deje de recibir uno. Las dos garantías viven en índices PARCIALES, que Prisma
 * no sabe declarar y por eso solo existen en el SQL de la migración.
 */

let actorId: string
let typeId: string
const created: string[] = []
const devices: string[] = []
const users: string[] = []

async function extraUser(email: string): Promise<string> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
  const user = await db.user.create({
    data: { id: uuidv7(), email, fullName: email, roleId: role.id },
    select: { id: true },
  })

  users.push(user.id)

  return user.id
}

beforeAll(async () => {
  actorId = (await actor()).id
  typeId = (await db.notificationType.findFirstOrThrow({ where: { code: 'REQ_AUTHORIZED' } })).id
})

afterAll(async () => {
  await db.notification.deleteMany({ where: { id: { in: created } } })
  await db.device.deleteMany({ where: { id: { in: devices } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await close()
})

async function insert(userId: string, entityId: string | null): Promise<string> {
  const id = uuidv7()

  await db.notification.create({
    data: {
      id,
      userId,
      notificationTypeId: typeId,
      title: 'Requisición autorizada',
      body: 'La requisición #1 fue autorizada',
      entityType: entityId ? 'requisition' : null,
      entityId,
    },
  })

  created.push(id)

  return id
}

describe('el catálogo de tipos', () => {
  it('tiene los 56 códigos del vault y ninguno repetido', async () => {
    const total = await db.notificationType.count()
    const codes = await db.notificationType.findMany({ select: { code: true } })

    expect(total).toBe(56)
    expect(new Set(codes.map((c) => c.code)).size).toBe(56)
  })

  it('PUNCH_REMINDER sigue sembrado sin regla de disparo', async () => {
    const row = await db.notificationType.findUniqueOrThrow({ where: { code: 'PUNCH_REMINDER' } })

    expect(row.description).toContain('SIN REGLA DE DISPARO')
  })
})

describe('el mismo evento no genera dos avisos', () => {
  it('rechaza el segundo insert del mismo (usuario, tipo, entidad)', async () => {
    const entityId = uuidv7()

    await insert(actorId, entityId)

    // Es el reintento de Pub/Sub, que entrega AL MENOS UNA VEZ.
    await expect(insert(actorId, entityId)).rejects.toThrow(/Unique constraint/i)
  })

  it('el mismo evento sí llega a dos personas distintas', async () => {
    const entityId = uuidv7()
    const otro = await extraUser(`fanout-${Date.now()}@oranje.local`)

    await insert(actorId, entityId)
    await insert(otro, entityId)

    const total = await db.notification.count({ where: { entityId } })

    expect(total).toBe(2)
  })

  it('los avisos genéricos sin entidad sí se repiten', async () => {
    await insert(actorId, null)
    await insert(actorId, null)

    const total = await db.notification.count({
      where: { userId: actorId, notificationTypeId: typeId, entityId: null },
    })

    expect(total).toBeGreaterThanOrEqual(2)
  })
})

describe('las restricciones de la fila', () => {
  it('no acepta un error de push sin intento de push', async () => {
    const id = await insert(actorId, uuidv7())

    await expect(
      db.notification.update({ where: { id }, data: { pushError: 'UNREGISTERED' } }),
    ).rejects.toThrow(/ck_notification_push/)
  })

  it('no acepta leerse antes de existir', async () => {
    const id = await insert(actorId, uuidv7())

    await expect(
      db.notification.update({ where: { id }, data: { readAt: new Date('2020-01-01') } }),
    ).rejects.toThrow(/ck_notification_read/)
  })

  it('no acepta media entidad', async () => {
    const id = uuidv7()

    await expect(
      db.notification.create({
        data: {
          id,
          userId: actorId,
          notificationTypeId: typeId,
          title: 'x',
          body: 'y',
          entityType: 'requisition',
          entityId: null,
        },
      }),
    ).rejects.toThrow(/ck_notification_entity/)
  })
})

describe('un token de FCM apunta a un solo usuario', () => {
  it('rechaza el mismo token vivo en dos dispositivos', async () => {
    const token = `tok-${uuidv7()}`
    const otro = await extraUser(`device-${Date.now()}@oranje.local`)

    const first = await db.device.create({
      data: { id: uuidv7(), userId: actorId, fcmToken: token, platform: 'ANDROID' },
      select: { id: true },
    })

    devices.push(first.id)

    await expect(
      db.device.create({
        data: { id: uuidv7(), userId: otro, fcmToken: token, platform: 'WEB' },
      }),
    ).rejects.toThrow(/Unique constraint|ux_device_token/i)
  })

  it('acepta reasignar el token después de revocarlo, porque el token rota', async () => {
    const token = `tok-${uuidv7()}`
    const otro = await extraUser(`rota-${Date.now()}@oranje.local`)

    const viejo = await db.device.create({
      data: { id: uuidv7(), userId: actorId, fcmToken: token, platform: 'ANDROID' },
      select: { id: true },
    })

    devices.push(viejo.id)
    await db.device.update({ where: { id: viejo.id }, data: { revokedAt: new Date() } })

    const nuevo = await db.device.create({
      data: { id: uuidv7(), userId: otro, fcmToken: token, platform: 'ANDROID' },
      select: { id: true },
    })

    devices.push(nuevo.id)
    expect(nuevo.id).toBeTruthy()
  })

  it('rechaza una plataforma que no existe', async () => {
    await expect(
      db.device.create({
        data: { id: uuidv7(), userId: actorId, fcmToken: `tok-${uuidv7()}`, platform: 'SYMBIAN' },
      }),
    ).rejects.toThrow(/ck_device_platform/)
  })
})
