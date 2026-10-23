import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ContractsRepository } from '../../src/modules/commercial/contracts/contracts.repository.js'
import { ContractsService } from '../../src/modules/commercial/contracts/contracts.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El candado del contrato ACTIVO (Hugo, 2026-10-21): se cuelga del status,
 * nunca lo toca. Un DRAFT no necesita desbloquearse — ya se edita — y un
 * EXPIRED/CANCELLED ya no se edita de ningún modo, así que el candado
 * tampoco aplica ahí.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const mailer = {
  send: (): Promise<{ status: string }> => Promise.resolve({ status: 'SENT' }),
} as unknown as MailerService
const contracts = new ContractsService(new ContractsRepository(prisma), notifications, mailer)

let user: AuthenticatedUser
let zoneId: string
let housekeeperId: string
const hotelIds: string[] = []

beforeAll(async () => {
  const row = await actor()
  user = { id: row.id, roleCode: 'ROL-V-01' } as AuthenticatedUser
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  housekeeperId = (
    await db.catalogPosition.findFirstOrThrow({
      where: { code: 'HOUSEKEEPER' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.contractRate.deleteMany({ where: { contract: { hotelId: { in: hotelIds } } } })
  await db.contract.deleteMany({ where: { hotelId: { in: hotelIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })
  await close()
})

async function bareHotel(etiqueta: string): Promise<string> {
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Lock ${etiqueta} ${hotelId.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      weekStartDay: 1,
      weekEndDay: 0,
      overtimePayMultiplier: 1.5,
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  hotelIds.push(hotelId)

  return hotelId
}

async function nuevoContrato(etiqueta: string): Promise<string> {
  const hotelId = await bareHotel(etiqueta)
  const created = await contracts.create(
    {
      hotelId,
      validFrom: new Date('2026-01-01'),
      overtimeBillMultiplier: 1.5,
      holidayBillMultiplier: 2,
      holidayPayMultiplier: 1,
      mealDeductionAmount: '0.00',
      splitsInvoiceByMonth: false,
      rates: [{ catalogPositionId: housekeeperId, payRate: '15.00', billRate: '20.00' }],
    },
    user,
  )

  return created.id
}

describe('candado del contrato', () => {
  it('nace ACTIVO bloqueado: isUnlocked false, sin pedirlo', async () => {
    const id = await nuevoContrato('nace-bloqueado')
    await contracts.activate(id, user)

    const row = await contracts.get(id)
    expect(row.isUnlocked).toBe(false)
  })

  it('desbloquear pide motivo y queda en el journal', async () => {
    const id = await nuevoContrato('desbloquea')
    await contracts.activate(id, user)

    const unlocked = await contracts.setLock(id, true, 'El hotel pidió corregir la dirección', user)
    expect(unlocked.isUnlocked).toBe(true)

    const entry = await db.journalEntry.findFirst({
      where: { entityType: 'commercial.contract', entityId: id, eventType: 'CONTRACT_UNLOCKED' },
    })
    expect(entry).not.toBeNull()
    expect(entry?.payload).toMatchObject({ reason: 'El hotel pidió corregir la dirección' })
  })

  it('se puede volver a bloquear, sin motivo, y también queda en el journal', async () => {
    const id = await nuevoContrato('rebloquea')
    await contracts.activate(id, user)
    await contracts.setLock(id, true, 'Corrección temporal', user)

    const locked = await contracts.setLock(id, false, null, user)
    expect(locked.isUnlocked).toBe(false)

    const entry = await db.journalEntry.findFirst({
      where: { entityType: 'commercial.contract', entityId: id, eventType: 'CONTRACT_LOCKED' },
    })
    expect(entry).not.toBeNull()
  })

  it('un Borrador no tiene candado que tocar', async () => {
    const id = await nuevoContrato('borrador')

    await expect(contracts.setLock(id, true, 'Motivo cualquiera', user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_NOT_ACTIVE' },
    })
  })

  it('uno ya cerrado tampoco', async () => {
    const id = await nuevoContrato('cerrado')
    await contracts.activate(id, user)
    await contracts.close(id, true, user)

    await expect(contracts.setLock(id, true, 'Motivo cualquiera', user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_NOT_ACTIVE' },
    })
  })

  it('marcar como enviado congela el borrador: queda bloqueado y en el journal', async () => {
    const id = await nuevoContrato('enviado')

    const sent = await contracts.markSent(id, user)
    expect(sent.sentAt).not.toBeNull()
    expect(sent.sentByName).not.toBeNull()
    expect(sent.status).toBe('DRAFT')
    expect(sent.isUnlocked).toBe(false)

    await expect(contracts.update(id, { propertyName: 'Otro nombre' }, user)).rejects.toMatchObject(
      { response: { code: 'CONTRACT_LOCKED' } },
    )

    const entry = await db.journalEntry.findFirst({
      where: { entityType: 'commercial.contract', entityId: id, eventType: 'CONTRACT_SENT' },
    })
    expect(entry).not.toBeNull()
  })

  it('no se marca dos veces como enviado', async () => {
    const id = await nuevoContrato('enviado-dos-veces')
    await contracts.markSent(id, user)

    await expect(contracts.markSent(id, user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_ALREADY_SENT' },
    })
  })

  it('un borrador enviado se desbloquea para corregirlo y al activarse vuelve a quedar bloqueado', async () => {
    const id = await nuevoContrato('enviado-corrige')
    await contracts.markSent(id, user)

    const unlocked = await contracts.setLock(id, true, 'El hotel pidió otra dirección', user)
    expect(unlocked.isUnlocked).toBe(true)
    const edited = await contracts.update(id, { propertyName: 'Nombre corregido' }, user)
    expect(edited.propertyName).toBe('Nombre corregido')

    const active = await contracts.activate(id, user)
    expect(active.status).toBe('ACTIVE')
    expect(active.isUnlocked).toBe(false)
    expect(active.signedByName).not.toBeNull()
  })

  // Hugo, 2026-10-23: al hotel no le llega un contrato con el cuadro vacío.
  it('sin tarifas no se envía, ni por correo ni marcándolo, y sigue sin enviar', async () => {
    const id = await nuevoContrato('sin-tarifas')
    await db.contractRate.deleteMany({ where: { contractId: id } })

    await expect(contracts.markSent(id, user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_WITHOUT_RATES' },
    })
    await expect(
      contracts.sendEmail(id, user, {
        to: 'hotel@example.com',
        note: null,
        pdf: Buffer.from('%PDF-1.4'),
      }),
    ).rejects.toMatchObject({ response: { code: 'CONTRACT_WITHOUT_RATES' } })

    const row = await contracts.get(id)
    expect(row.sentAt).toBeNull()
  })

  it('enviar por correo un borrador lo deja enviado y bloqueado', async () => {
    const id = await nuevoContrato('correo')

    const result = await contracts.sendEmail(id, user, {
      to: 'hotel@example.com',
      note: null,
      pdf: Buffer.from('%PDF-1.4'),
    })
    expect(result).toMatchObject({ status: 'SENT' })

    const row = await contracts.get(id)
    expect(row.sentAt).not.toBeNull()
    expect(row.isUnlocked).toBe(false)
  })
})
