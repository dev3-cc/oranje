import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ProposalsRepository } from '../../src/modules/commercial/onboarding/proposals.repository.js'
import { ProposalsService } from '../../src/modules/commercial/onboarding/proposals.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Hugo, 2026-10-16: un hotel cliente (Naranja) que se quedó SIN contrato
 * vigente —nunca se le generó uno al convertir, o el que tenía venció o se
 * canceló sin renovarse— necesita poder volver a cotizar, sin retroceder el
 * semáforo. Uno que ya tiene su contrato activo se queda cerrado como
 * siempre: esta excepción no reabre a un cliente servido.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const repo = new ProposalsRepository(prisma)
const mailer = {} as unknown as MailerService
const proposals = new ProposalsService(repo, notifications, mailer)

let user: AuthenticatedUser
let zoneId: string
let positionId: string
const prospects: string[] = []
const hotels: string[] = []
const contracts: string[] = []

async function nuevoProspectoNaranja(): Promise<{ prospectId: string; hotelId: string }> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: 'ORANGE', statusLightCode: 'ONBOARDING' },
    select: { id: true },
  })
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Naranja ${hotelId.slice(-8)}`,
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

  return { prospectId, hotelId }
}

async function activarContrato(hotelId: string): Promise<void> {
  const id = uuidv7()

  await db.contract.create({
    data: {
      id,
      hotelId,
      number: `CT-TEST-${id.slice(-8)}`,
      validFrom: new Date('2026-01-01'),
      weekStartDay: 1,
      weekEndDay: 0,
      status: 'ACTIVE',
    },
  })
  contracts.push(id)
}

beforeAll(async () => {
  const row = await actor()
  user = { id: row.id, roleCode: 'ROL-V-01' } as AuthenticatedUser

  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.proposal.deleteMany({ where: { prospectId: { in: prospects } } })
  await db.contract.deleteMany({ where: { id: { in: contracts } } })
  await db.prospect.deleteMany({ where: { id: { in: prospects } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('Naranja sin contrato vigente reabre la propuesta', () => {
  it('sin ningún contrato, Naranja se trabaja como Verde o Café', async () => {
    const { prospectId } = await nuevoProspectoNaranja()

    const draft = await proposals.create(
      prospectId,
      { rates: [{ catalogPositionId: positionId, payRate: '15', billRate: '20' }] },
      user,
    )

    expect(draft.rates).toHaveLength(1)
  })

  it('con un contrato activo, Naranja se queda cerrado como siempre', async () => {
    const { prospectId, hotelId } = await nuevoProspectoNaranja()
    await activarContrato(hotelId)

    await expect(
      proposals.create(
        prospectId,
        { rates: [{ catalogPositionId: positionId, payRate: '15', billRate: '20' }] },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'PROPOSAL_STATE_INVALID' } })
  })

  it('un contrato vencido o cancelado NO cuenta como vigente: Naranja se reabre igual', async () => {
    const { prospectId, hotelId } = await nuevoProspectoNaranja()
    const id = uuidv7()

    await db.contract.create({
      data: {
        id,
        hotelId,
        number: `CT-TEST-${id.slice(-8)}`,
        validFrom: new Date('2025-01-01'),
        weekStartDay: 1,
        weekEndDay: 0,
        status: 'EXPIRED',
      },
    })
    contracts.push(id)

    const draft = await proposals.create(
      prospectId,
      { rates: [{ catalogPositionId: positionId, payRate: '15', billRate: '20' }] },
      user,
    )

    expect(draft.rates).toHaveLength(1)
  })
})
