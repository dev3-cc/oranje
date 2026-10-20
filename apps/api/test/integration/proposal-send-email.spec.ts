import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { FirebaseAccountsService } from '../../src/infra/firebase/index.js'
import { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { ProposalsRepository } from '../../src/modules/commercial/onboarding/proposals.repository.js'
import { ProposalsService } from '../../src/modules/commercial/onboarding/proposals.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * `título` y `enviar por correo de verdad` (Hugo, 2026-10-17): el campo nuevo
 * que distingue un ciclo en una lista, y el envío que deja de ser un `mailto`
 * para pasar por el mailer propio, con el PDF que el front ya generó.
 *
 * El mailer corre SIN configurar a propósito (igual que `mailer.spec.ts`): es
 * el estado real de dev/CI, y entonces `sendEmail` cae al "sin respaldo" de
 * `proposal-sent` — lo que importa aquí es que la propuesta se congela de
 * todos modos (es el hecho de negocio) y el intento queda registrado, nunca
 * que el correo salga de verdad por un SMTP que no existe en este entorno.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const firebaseSinUsar = {} as unknown as FirebaseAccountsService
const configSinSmtp = { get: () => undefined } as unknown as ConstructorParameters<
  typeof MailerService
>[0]
const mailer = new MailerService(
  configSinSmtp,
  prisma,
  firebaseSinUsar,
  new SettingsService(prisma),
)
const proposals = new ProposalsService(new ProposalsRepository(prisma), notifications, mailer)

let user: AuthenticatedUser
let zoneId: string
const prospects: string[] = []
const hotels: string[] = []
const emails: string[] = []

async function nuevoProspecto(): Promise<string> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'ONBOARDING' },
    select: { id: true },
  })
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Envío ${hotelId.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  hotels.push(hotelId)

  const id = uuidv7()

  await db.prospect.create({
    data: {
      id,
      hotelId,
      ownerUserId: user.id,
      onboardingStateId: state.id,
      statusLightCode: 'ONBOARDING',
      createdBy: user.id,
      updatedBy: user.id,
    },
  })
  prospects.push(id)

  return id
}

beforeAll(async () => {
  const row = await actor()
  user = { id: row.id, roleCode: 'ROL-V-01' } as AuthenticatedUser
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.emailDelivery.deleteMany({ where: { toEmail: { in: emails } } })
  await db.proposal.deleteMany({ where: { prospectId: { in: prospects } } })
  await db.prospect.deleteMany({ where: { id: { in: prospects } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('título de la propuesta', () => {
  it('se guarda al crear, se corrige al editar, y un PATCH sin él no lo borra', async () => {
    const prospectId = await nuevoProspecto()

    const draft = await proposals.create(prospectId, { title: 'Housekeeping temporada alta' }, user)
    expect(draft.title).toBe('Housekeeping temporada alta')

    const corregido = await proposals.update(
      prospectId,
      draft.id,
      { title: 'Housekeeping + Steward temporada alta' },
      user,
    )
    expect(corregido.title).toBe('Housekeeping + Steward temporada alta')

    // El PATCH de guardar tarifas no manda título: el que ya tenía se queda.
    const soloTarifas = await proposals.update(prospectId, draft.id, { servicesNote: 'Nota' }, user)
    expect(soloTarifas.title).toBe('Housekeeping + Steward temporada alta')
  })

  it('sin título (las versiones de antes de hoy), se lee null, no inventado', async () => {
    const prospectId = await nuevoProspecto()
    const draft = await proposals.create(prospectId, {}, user)
    expect(draft.title).toBeNull()
  })
})

describe('enviar propuesta por correo', () => {
  it('congela la versión aunque el mailer no tenga a dónde salir, y el intento queda registrado', async () => {
    const prospectId = await nuevoProspecto()
    const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })

    const draft = await proposals.create(
      prospectId,
      {
        title: 'Propuesta de prueba',
        rates: [{ catalogPositionId: position.id, payRate: '16.00', billRate: '20.00' }],
      },
      user,
    )

    const to = `envio-prueba-${Date.now()}@oranje.local`
    emails.push(to)

    const { proposal, email } = await proposals.sendEmail(prospectId, draft.id, user, {
      to,
      note: 'Aquí va lo que platicamos ayer.',
      pdf: Buffer.from('%PDF-1.4 documento de mentira'),
    })

    // El hecho de negocio: la versión queda enviada pase lo que pase con el correo.
    expect(proposal.sentAt).not.toBeNull()
    expect(proposal.isDraft).toBe(false)

    // Sin SMTP en este entorno y sin respaldo de Firebase para esta plantilla: falla, no revienta.
    expect(email.status).toBe('FAILED')

    const fila = await db.emailDelivery.findFirst({
      where: { toEmail: to },
      orderBy: { createdAt: 'desc' },
    })
    expect(fila).toMatchObject({ template: 'proposal-sent', status: 'FAILED' })
  })

  it('sin tarifas no se congela ni se intenta mandar nada (PROPOSAL_WITHOUT_RATES)', async () => {
    const prospectId = await nuevoProspecto()
    const draft = await proposals.create(prospectId, { title: 'Vacía' }, user)

    await expect(
      proposals.sendEmail(prospectId, draft.id, user, {
        to: 'nadie@oranje.local',
        note: null,
        pdf: Buffer.from('x'),
      }),
    ).rejects.toMatchObject({ response: { code: 'PROPOSAL_WITHOUT_RATES' } })
  })
})
