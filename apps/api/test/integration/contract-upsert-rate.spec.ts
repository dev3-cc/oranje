import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ContractsRepository } from '../../src/modules/commercial/contracts/contracts.repository.js'
import { ContractsService } from '../../src/modules/commercial/contracts/contracts.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * `PATCH /contracts/:id/rates` llamaba a `upsertRate()`, que hacía
 * `ON CONFLICT ON CONSTRAINT ux_contract_rate_position` — pero esa es una
 * UNIQUE INDEX, no una constraint con nombre, así que la sentencia fallaba
 * con el error 42704 de Postgres SIEMPRE que la posición ya tenía tarifa en
 * ese contrato. Nadie lo había probado: `create()` inserta de una sola vez
 * sin `ON CONFLICT` y por eso el camino roto nunca se ejercitó en tests
 * (Hugo, 2026-10-09). Corregido a `ON CONFLICT (contract_id,
 * catalog_position_id)`, que Postgres infiere desde el índice sin
 * necesitar su nombre.
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

async function bareHotel(etiqueta: string): Promise<string> {
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Rate ${etiqueta} ${hotelId.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  hotelIds.push(hotelId)

  return hotelId
}

test('setRate no truena al repetir la misma posición: actualiza, no duplica', async () => {
  const hotelId = await bareHotel('upsert')
  const created = await contracts.create(
    {
      hotelId,
      validFrom: new Date(),
      weekStartDay: 1,
      weekEndDay: 0,
      overtimeBillMultiplier: 1.5,
      overtimePayMultiplier: 1,
      holidayBillMultiplier: 2,
      holidayPayMultiplier: 1,
      deductsMeals: false,
      splitsInvoiceByMonth: false,
      rates: [{ catalogPositionId: housekeeperId, payRate: '13.50', billRate: '17.55' }],
    },
    user,
  )

  // Primera llamada a setRate sobre una posición YA cotizada por create():
  // este es exactamente el camino que antes moría con 42704.
  await expect(
    contracts.setRate(
      created.id,
      { catalogPositionId: housekeeperId, payRate: '15.00', billRate: '19.50' },
      user,
    ),
  ).resolves.toBeDefined()

  const rates = await db.contractRate.findMany({ where: { contractId: created.id } })

  expect(rates).toHaveLength(1)
  expect(Number(rates[0]?.payRate)).toBe(15)
  expect(Number(rates[0]?.billRate)).toBe(19.5)
})
