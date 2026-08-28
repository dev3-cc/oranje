import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ProposalsRepository } from '../../src/modules/commercial/onboarding/proposals.repository.js'
import { ProposalsService } from '../../src/modules/commercial/onboarding/proposals.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El borrador se borra; lo ENVIADO jamás. Como la fila muere, lo único que
 * queda del descarte es la entrada del journal: por eso se verifica.
 *
 * Los servicios se arman a mano y no con el AppModule: levantarlo abre un
 * SEGUNDO pool de conexiones y la suite completa se queda sin ninguna.
 */

const prisma = db as unknown as PrismaService
const proposals = new ProposalsService(new ProposalsRepository(prisma))
const permissions = new PermissionsService(prisma)

let user: AuthenticatedUser
let prospectId: string
let zoneId: string
const prospects: string[] = []
const hotels: string[] = []

// Un hotel por prospecto: ux_prospect_hotel_open admite un solo ciclo abierto.
async function nuevoProspecto(stateCode = 'GREEN'): Promise<string> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: stateCode, statusLightCode: 'ONBOARDING' },
    select: { id: true },
  })
  const hotelId = uuidv7()

  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Descarte ${hotelId.slice(-8)}`,
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
  prospectId = await nuevoProspecto()
})

afterAll(async () => {
  await db.proposal.deleteMany({ where: { prospectId: { in: prospects } } })
  await db.prospect.deleteMany({ where: { id: { in: prospects } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('descartar un borrador', () => {
  it('lo borra, devuelve nada y deja el hecho en el journal', async () => {
    const draft = await proposals.create(prospectId, {}, user)

    await proposals.discardDraft(prospectId, draft.id, user)

    expect(await db.proposal.findUnique({ where: { id: draft.id } })).toBeNull()

    const entry = await db.journalEntry.findFirst({
      where: { entityId: prospectId, eventType: 'PROPOSAL_DRAFT_DISCARDED' },
      orderBy: { occurredAt: 'desc' },
    })

    expect(entry).not.toBeNull()
    expect(entry?.payload).toMatchObject({ proposalId: draft.id, version: draft.version })
  })

  it('lo enviado NO se borra, y la fila sigue ahí', async () => {
    const id = await nuevoProspecto()
    const draft = await proposals.create(id, {}, user)

    await proposals.send(id, draft.id, user)

    await expect(proposals.discardDraft(id, draft.id, user)).rejects.toMatchObject({
      response: { code: 'PROPOSAL_SENT' },
    })

    expect(await db.proposal.findUnique({ where: { id: draft.id } })).not.toBeNull()
  })

  it('una propuesta de OTRO prospecto no existe para este', async () => {
    const otro = await nuevoProspecto()
    const ajena = await proposals.create(otro, {}, user)

    await expect(proposals.discardDraft(prospectId, ajena.id, user)).rejects.toMatchObject({
      response: { code: 'PROPOSAL_NOT_FOUND' },
    })
  })

  it('funciona aunque el prospecto ya no esté en Verde ni Café', async () => {
    const id = await nuevoProspecto()
    const draft = await proposals.create(id, {}, user)

    const yellow = await db.statusLightState.findFirstOrThrow({
      where: { code: 'YELLOW', statusLightCode: 'ONBOARDING' },
      select: { id: true },
    })

    await db.prospect.update({ where: { id }, data: { onboardingStateId: yellow.id } })

    // Crear ahi ya no se puede; descartar lo que quedo abierto si.
    await expect(proposals.create(id, {}, user)).rejects.toMatchObject({
      response: { code: 'PROPOSAL_STATE_INVALID' },
    })
    await expect(proposals.discardDraft(id, draft.id, user)).resolves.toBeUndefined()
  })

  it('libera el número de versión: crear v2, borrarla y crear de nuevo da v2', async () => {
    const id = await nuevoProspecto()

    const v1 = await proposals.create(id, {}, user)
    await proposals.send(id, v1.id, user)

    const v2 = await proposals.create(id, {}, user)
    expect(v2.version).toBe(2)

    await proposals.discardDraft(id, v2.id, user)

    const otraVez = await proposals.create(id, {}, user)
    expect(otraVez.version).toBe(2)
  })

  it('un rol sin proposals:create no puede descartar', async () => {
    // Es lo que hace 403 al guard.
    expect(await permissions.can('ROL-R-01', 'proposals', 'create')).toBe(false)
    expect(await permissions.can('ROL-V-01', 'proposals', 'create')).toBe(true)
  })
})
