import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ContractsRepository } from '../../src/modules/commercial/contracts/contracts.repository.js'
import { ContractsService } from '../../src/modules/commercial/contracts/contracts.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Edición de contrato (Hugo, 2026-10-16): el BDC lo sigue tocando después de
 * crearlo — en Borrador y también ya ACTIVO, porque lo que paga una semana
 * es la copia congelada en `consolidation_detail`, nunca la tarifa en vivo.
 * Lo único que de verdad cierra la puerta es que el contrato ya esté
 * EXPIRED/CANCELLED.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const contracts = new ContractsService(new ContractsRepository(prisma), notifications)

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

async function bareHotel(etiqueta: string, overtimePayMultiplier = 1.5): Promise<string> {
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Update ${etiqueta} ${hotelId.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      weekStartDay: 1,
      weekEndDay: 0,
      overtimePayMultiplier,
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  hotelIds.push(hotelId)

  return hotelId
}

async function nuevoContrato(etiqueta: string): Promise<{ id: string; hotelId: string }> {
  const hotelId = await bareHotel(etiqueta)
  const created = await contracts.create(
    {
      hotelId,
      validFrom: new Date('2026-01-01'),
      overtimeBillMultiplier: 1.5,
      holidayBillMultiplier: 2,
      holidayPayMultiplier: 1,
      deductsMeals: false,
      splitsInvoiceByMonth: false,
      rates: [{ catalogPositionId: housekeeperId, payRate: '15.00', billRate: '20.00' }],
    },
    user,
  )

  return { id: created.id, hotelId }
}

describe('editar un contrato ya creado', () => {
  it('en Borrador: cambia los campos y deja rastro en el journal', async () => {
    const { id } = await nuevoContrato('draft')

    const updated = await contracts.update(
      id,
      { deductsMeals: true, splitsInvoiceByMonth: true, holidayBillMultiplier: 2.5 },
      user,
    )

    expect(updated.deductsMeals).toBe(true)
    expect(updated.splitsInvoiceByMonth).toBe(true)
    expect(updated.multipliers.holidayBill).toBe('2.50')
    expect(updated.updatedAt).not.toBeNull()

    const entry = await db.journalEntry.findFirst({
      where: { entityType: 'commercial.contract', entityId: id, eventType: 'CONTRACT_UPDATED' },
    })
    expect(entry).not.toBeNull()
  })

  it('ACTIVO: también se edita, y setRate ya no lo rechaza', async () => {
    const { id } = await nuevoContrato('active')
    await contracts.activate(id, user)

    const updated = await contracts.update(id, { validTo: new Date('2027-01-01') }, user)
    expect(updated.validTo).toBe('2027-01-01')

    // El camino que antes moría con CONTRACT_NOT_DRAFT: una tarifa corregida
    // sobre un contrato ya vigente.
    const withRate = await contracts.setRate(
      id,
      { catalogPositionId: housekeeperId, payRate: '16.00', billRate: '21.00' },
      user,
    )
    expect(withRate.rates?.[0]?.payRate).toBe('16.00')
  })

  it('EXPIRED/CANCELLED: ya no se edita', async () => {
    const { id } = await nuevoContrato('closed')
    await contracts.activate(id, user)
    await contracts.close(id, true, user)

    await expect(contracts.update(id, { deductsMeals: true }, user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_CLOSED' },
    })
  })

  it('la vigencia no puede terminar antes de empezar', async () => {
    const { id } = await nuevoContrato('vigencia')

    await expect(
      contracts.update(id, { validTo: new Date('2025-01-01') }, user),
    ).rejects.toMatchObject({ response: { code: 'VALIDITY_BACKWARDS' } })
  })

  it('el hotel no puede pagar menos recargo que el colaborador', async () => {
    const { id } = await nuevoContrato('margen')

    await expect(
      contracts.update(id, { holidayBillMultiplier: 1, holidayPayMultiplier: 1.5 }, user),
    ).rejects.toMatchObject({ response: { code: 'HOLIDAY_MARGIN_NEGATIVE' } })
  })
})
