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
 * "No puede haber contrato sin propuesta" (Hugo, 2026-10-21): el contrato
 * guarda de qué VERSIÓN exacta de la Propuesta nace, para el hipervínculo del
 * detalle (`/proposals/:prospectId/:version`). Nulable igual que prospectId:
 * un contrato heredado o migrado puede no tenerla.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const mailer = {} as unknown as MailerService
const contracts = new ContractsService(new ContractsRepository(prisma), notifications, mailer)

let user: AuthenticatedUser
let zoneId: string
let housekeeperId: string
let onboardingGreenId: string
const hotelIds: string[] = []
const prospectIds: string[] = []
const proposalIds: string[] = []

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
  onboardingGreenId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'GREEN', statusLightCode: 'ONBOARDING' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.contractRate.deleteMany({ where: { contract: { hotelId: { in: hotelIds } } } })
  await db.contract.deleteMany({ where: { hotelId: { in: hotelIds } } })
  await db.proposal.deleteMany({ where: { id: { in: proposalIds } } })
  await db.prospect.deleteMany({ where: { id: { in: prospectIds } } })
  await db.hotel.deleteMany({ where: { id: { in: hotelIds } } })
  await close()
})

async function bareHotel(etiqueta: string): Promise<string> {
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Propuesta ${etiqueta} ${hotelId.slice(-8)}`,
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

/** Una Propuesta mínima, directa a la base: no hace falta el cuadro de
    tarifas ni enviarla de verdad, solo que exista la fila (la FK de
    `contract.proposal_id` la exige). */
async function nuevaPropuesta(
  hotelId: string,
  version = 1,
): Promise<{ id: string; prospectId: string }> {
  const prospectId = uuidv7()

  await db.prospect.create({
    data: {
      id: prospectId,
      hotelId,
      ownerUserId: user.id,
      onboardingStateId: onboardingGreenId,
      statusLightCode: 'ONBOARDING',
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  prospectIds.push(prospectId)

  const proposalId = uuidv7()

  await db.proposal.create({
    data: { id: proposalId, prospectId, version, sentAt: new Date() },
  })
  proposalIds.push(proposalId)

  return { id: proposalId, prospectId }
}

describe('contrato ↔ propuesta de origen', () => {
  it('nace con el hipervínculo: id, prospectId y version de la propuesta', async () => {
    const hotelId = await bareHotel('nace-con-propuesta')
    const proposal = await nuevaPropuesta(hotelId, 2)

    const created = await contracts.create(
      {
        hotelId,
        proposalId: proposal.id,
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

    expect(created.proposal).toEqual({
      id: proposal.id,
      prospectId: proposal.prospectId,
      version: 2,
    })

    // Y se lee igual en un GET aparte, no solo en la respuesta del create.
    const fetched = await contracts.get(created.id)
    expect(fetched.proposal).toEqual({
      id: proposal.id,
      prospectId: proposal.prospectId,
      version: 2,
    })
  })

  it('sin proposalId, nace sin propuesta de origen — no se inventa una', async () => {
    const hotelId = await bareHotel('sin-propuesta')

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

    expect(created.proposal).toBeNull()
  })

  it('un proposalId que no existe truena por la llave foránea, no se guarda silenciosamente', async () => {
    const hotelId = await bareHotel('propuesta-inexistente')

    await expect(
      contracts.create(
        {
          hotelId,
          proposalId: uuidv7(),
          validFrom: new Date('2026-01-01'),
          overtimeBillMultiplier: 1.5,
          holidayBillMultiplier: 2,
          holidayPayMultiplier: 1,
          mealDeductionAmount: '0.00',
          splitsInvoiceByMonth: false,
          rates: [{ catalogPositionId: housekeeperId, payRate: '15.00', billRate: '20.00' }],
        },
        user,
      ),
    ).rejects.toThrow()
  })
})
