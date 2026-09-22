import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ContractsRepository } from '../../src/modules/commercial/contracts/contracts.repository.js'
import { ContractsService } from '../../src/modules/commercial/contracts/contracts.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * `GET /contracts/position-rate` (Hugo, 2026-09-22): al asignar un slot,
 * Reclutamiento ve cuánto se le paga a la posición — nunca la factura al
 * hotel, eso sigue siendo solo de `terms_and_conditions` (Ventas). Cubre el
 * caso honesto: sin contrato activo, o con contrato pero sin esa posición
 * cotizada, la respuesta es `null`, no un error.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const contracts = new ContractsService(new ContractsRepository(prisma), notifications)

let user: AuthenticatedUser
let zoneId: string
let housekeeperId: string
let laundryId: string
const hotelIds: string[] = []

async function bareHotel(etiqueta: string): Promise<string> {
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Pago ${etiqueta} ${hotelId.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  hotelIds.push(hotelId)

  return hotelId
}

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
  laundryId = (
    await db.catalogPosition.findFirstOrThrow({ where: { code: 'LAUNDRY' }, select: { id: true } })
  ).id
})

afterAll(async () => {
  await db.contractRate.deleteMany({ where: { contract: { hotelId: { in: hotelIds } } } })
  await db.contract.deleteMany({ where: { hotelId: { in: hotelIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })
  await close()
})

test('sin contrato activo, la respuesta es null, no un error', async () => {
  const hotelId = await bareHotel('sin-contrato')

  await expect(contracts.positionPayRate(hotelId, housekeeperId)).resolves.toBeNull()
})

test('con contrato activo pero sin esa posición cotizada, también null', async () => {
  const hotelId = await bareHotel('sin-puesto')
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
  await contracts.activate(created.id, user)

  await expect(contracts.positionPayRate(hotelId, laundryId)).resolves.toBeNull()
})

test('con contrato activo y la posición cotizada, devuelve el pago (no la factura)', async () => {
  const hotelId = await bareHotel('con-puesto')
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
  await contracts.activate(created.id, user)

  const rate = await contracts.positionPayRate(hotelId, housekeeperId)

  expect(rate).toMatchObject({ payRate: '13.50', contractNumber: created.number })
  expect(JSON.stringify(rate)).not.toContain('17.55')
})

test('el permiso lo tienen Reclutamiento y Sistema, nunca Ventas', async () => {
  const rows = await prisma.$queryRaw<Array<{ code: string }>>`
    SELECT r.code
      FROM identity.role_permission rp
      JOIN identity.role r ON r.id = rp.role_id
     WHERE rp.module = 'requisitions' AND rp.action = 'read_position_pay'
     ORDER BY r.code`

  const roleCodes = rows.map((row) => row.code)

  expect(roleCodes).toEqual(
    expect.arrayContaining(['ROL-R-01', 'ROL-R-02', 'ROL-R-03', 'ROL-SYS-01']),
  )
  expect(roleCodes).not.toContain('ROL-V-01')
  expect(roleCodes).not.toContain('ROL-V-02')
})
