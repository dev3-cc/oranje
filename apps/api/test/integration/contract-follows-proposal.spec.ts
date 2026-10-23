import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ContractsRepository } from '../../src/modules/commercial/contracts/contracts.repository.js'
import { ContractsService } from '../../src/modules/commercial/contracts/contracts.service.js'
import { ProposalsRepository } from '../../src/modules/commercial/onboarding/proposals.repository.js'
import { ProposalsService } from '../../src/modules/commercial/onboarding/proposals.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El contrato sigue a la propuesta (Hugo, 2026-10-23, Villa Magna): corrigió
 * la propuesta con una versión nueva, la envió, y el contrato seguía con las
 * tarifas de la vieja. El borrador sin enviar se actualiza solo al enviar la
 * versión nueva; el ya enviado está bloqueado y se actualiza a mano, después
 * de desbloquearlo.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const mailer = {
  send: (): Promise<{ status: string }> => Promise.resolve({ status: 'SENT' }),
} as unknown as MailerService
const proposals = new ProposalsService(new ProposalsRepository(prisma), notifications, mailer)
const contracts = new ContractsService(new ContractsRepository(prisma), notifications, mailer)

let user: AuthenticatedUser
let zoneId: string
let positionId: string
const hotels: string[] = []
const prospects: string[] = []

beforeAll(async () => {
  const row = await actor()
  user = { id: row.id, roleCode: 'ROL-V-01' } as AuthenticatedUser
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  positionId = (
    await db.catalogPosition.findFirstOrThrow({
      where: { code: 'HOUSEKEEPER' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.contractRate.deleteMany({ where: { contract: { hotelId: { in: hotels } } } })
  await db.contract.deleteMany({ where: { hotelId: { in: hotels } } })
  await db.proposal.deleteMany({ where: { prospectId: { in: prospects } } })
  await db.prospect.deleteMany({ where: { id: { in: prospects } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

/** Un hotel en Verde con la v1 enviada a $10/$10 y su contrato en borrador. */
async function cicloConContrato(): Promise<{ prospectId: string; contractId: string }> {
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Sigue ${hotelId.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      weekStartDay: 1,
      weekEndDay: 0,
      overtimePayMultiplier: 1.5,
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  hotels.push(hotelId)

  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'ONBOARDING' },
    select: { id: true },
  })
  const prospectId = uuidv7()

  await db.prospect.create({
    data: {
      id: prospectId,
      hotelId,
      ownerUserId: user.id,
      onboardingStateId: state.id,
      statusLightCode: 'ONBOARDING',
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  prospects.push(prospectId)

  const v1 = await proposals.create(
    prospectId,
    { rates: [{ catalogPositionId: positionId, payRate: '10.00', billRate: '10.00' }] },
    user,
  )
  await proposals.send(prospectId, v1.id, user)

  const contract = await contracts.create(
    {
      hotelId,
      prospectId,
      proposalId: v1.id,
      validFrom: new Date('2026-11-01'),
      overtimeBillMultiplier: 1.5,
      holidayBillMultiplier: 2,
      holidayPayMultiplier: 1,
      mealDeductionAmount: '0.00',
      splitsInvoiceByMonth: false,
      rates: [{ catalogPositionId: positionId, payRate: '10.00', billRate: '10.00' }],
    },
    user,
  )

  return { prospectId, contractId: contract.id }
}

/** La v2 corregida a $50/$100, enviada. */
async function enviarV2(prospectId: string): Promise<void> {
  const v2 = await proposals.create(prospectId, {}, user)
  await proposals.update(
    prospectId,
    v2.id,
    { rates: [{ catalogPositionId: positionId, payRate: '50.00', billRate: '100.00' }] },
    user,
  )
  await proposals.send(prospectId, v2.id, user)
}

describe('el contrato sigue a la propuesta', () => {
  it('enviar una versión nueva le pasa sus tarifas al borrador que aún no se envía', async () => {
    const { prospectId, contractId } = await cicloConContrato()

    await enviarV2(prospectId)

    const contract = await contracts.get(contractId)
    expect(contract.proposal?.version).toBe(2)
    expect(contract.latestProposal?.version).toBe(2)
    expect(contract.rates).toHaveLength(1)
    expect(contract.rates?.[0]).toMatchObject({ payRate: '50.00', billRate: '100.00' })

    const entry = await db.journalEntry.findFirst({
      where: { entityId: contractId, eventType: 'CONTRACT_RATES_FROM_PROPOSAL' },
    })
    expect(entry).not.toBeNull()
  })

  it('el borrador ya enviado no cambia solo: avisa, y se actualiza al desbloquearlo', async () => {
    const { prospectId, contractId } = await cicloConContrato()
    await contracts.markSent(contractId, user)

    await enviarV2(prospectId)

    const atras = await contracts.get(contractId)
    expect(atras.proposal?.version).toBe(1)
    expect(atras.latestProposal?.version).toBe(2)
    expect(atras.rates?.[0]).toMatchObject({ payRate: '10.00', billRate: '10.00' })

    await expect(contracts.syncFromProposal(contractId, user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_LOCKED' },
    })

    await contracts.setLock(contractId, true, 'El hotel aceptó la v2', user)
    const alDia = await contracts.syncFromProposal(contractId, user)
    expect(alDia.proposal?.version).toBe(2)
    expect(alDia.rates?.[0]).toMatchObject({ payRate: '50.00', billRate: '100.00' })

    await expect(contracts.syncFromProposal(contractId, user)).rejects.toMatchObject({
      response: { code: 'CONTRACT_PROPOSAL_CURRENT' },
    })
  })
})
