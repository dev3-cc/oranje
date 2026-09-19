import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { ProposalsRepository } from '../../src/modules/commercial/onboarding/proposals.repository.js'
import { ProposalsService } from '../../src/modules/commercial/onboarding/proposals.service.js'
import type { NotificationPublisherService } from '../../src/modules/notifications/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El cuadro de tarifas POR PUESTO de la Propuesta Personalizada: el Exhibit "A"
 * que se copia renglón por renglón al Documento de T&C.
 *
 * Lo que se protege aquí son las cuatro reglas del cuadro —un renglón por
 * puesto, el puesto existe en el catálogo, el bill nunca por debajo del pay, y
 * no se envía una propuesta sin nada cotizado— más el hecho de que editar
 * REEMPLAZA el cuadro entero en vez de acumular renglones.
 *
 * Los servicios se arman a mano y no con el AppModule: levantarlo abre un
 * SEGUNDO pool de conexiones y la suite completa se queda sin ninguna.
 */

const prisma = db as unknown as PrismaService
// Stub: el envío de propuesta ya no es mudo (dispara SALES_PROPOSAL_SENT), y
// el constructor exige el publicador aunque esta suite no lo verifique.
const notifications = { publish: async () => {} } as unknown as NotificationPublisherService
const proposals = new ProposalsService(new ProposalsRepository(prisma), notifications)

let user: AuthenticatedUser
let zoneId: string
const prospects: string[] = []
const hotels: string[] = []

/**
 * Los puestos salen del catálogo por `code`: los ids son distintos en cada
 * instancia y sembrar uno nuevo ensuciaría un catálogo que comparte staging.
 */
const CODES = ['CHEF', 'HOUSEKEEPER', 'HOUSEMAN', 'LAUNDRY'] as const
const position = new Map<string, { id: string; code: string; name: string }>()

const idOf = (code: (typeof CODES)[number]): string => position.get(code)!.id

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
      name: `Hotel Tarifas ${hotelId.slice(-8)}`,
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

  for (const code of CODES) {
    const p = await db.catalogPosition.findUniqueOrThrow({
      where: { code },
      select: { id: true, code: true, name: true },
    })

    position.set(code, p)
  }
})

afterAll(async () => {
  // Los renglones caen solos: proposal_rate.proposal_id es ON DELETE CASCADE.
  await db.proposal.deleteMany({ where: { prospectId: { in: prospects } } })
  await db.prospect.deleteMany({ where: { id: { in: prospects } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('el cuadro de tarifas por puesto', () => {
  it('se guarda completo y se lee ordenado por nombre del puesto, con dos decimales', async () => {
    const prospectId = await nuevoProspecto()

    // A propósito en desorden: el orden lo pone la lectura, no la captura.
    const draft = await proposals.create(
      prospectId,
      {
        rates: [
          { catalogPositionId: idOf('LAUNDRY'), payRate: '15', billRate: '19.5' },
          { catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '21.85' },
          { catalogPositionId: idOf('HOUSEKEEPER'), payRate: '16.00', billRate: '20.28' },
        ],
      },
      user,
    )

    expect(draft.rates.map((r) => r.position.name)).toEqual(['Chef', 'Housekeeper', 'Laundry'])

    expect(draft.rates[0]).toMatchObject({
      position: position.get('CHEF'),
      payRate: '17.00',
      billRate: '21.85',
    })

    // "15" y "19.5" entraron sin decimales completos y salen normalizados.
    expect(draft.rates[2]).toMatchObject({ payRate: '15.00', billRate: '19.50' })

    // La lectura del expediente ve lo mismo que devolvió el alta.
    const [leida] = await proposals.list(prospectId)
    expect(leida?.rates).toEqual(draft.rates)
  })

  it('editar REEMPLAZA el cuadro entero: nada duplicado, nada huérfano', async () => {
    const prospectId = await nuevoProspecto()

    const draft = await proposals.create(
      prospectId,
      {
        rates: [
          { catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '21.85' },
          { catalogPositionId: idOf('HOUSEKEEPER'), payRate: '16.00', billRate: '20.28' },
          { catalogPositionId: idOf('LAUNDRY'), payRate: '15.00', billRate: '19.50' },
        ],
      },
      user,
    )

    // Se va Laundry, Chef se renegocia y entra Houseman.
    const editada = await proposals.update(
      prospectId,
      draft.id,
      {
        rates: [
          { catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '22.50' },
          { catalogPositionId: idOf('HOUSEKEEPER'), payRate: '16.00', billRate: '20.28' },
          { catalogPositionId: idOf('HOUSEMAN'), payRate: '14.00', billRate: '18.20' },
        ],
      },
      user,
    )

    expect(editada.rates.map((r) => r.position.code)).toEqual(['CHEF', 'HOUSEKEEPER', 'HOUSEMAN'])
    expect(editada.rates.map((r) => r.billRate)).toEqual(['22.50', '20.28', '18.20'])

    // Lo que cuenta la base: tres filas, ni una del cuadro anterior.
    const filas = await db.proposalRate.findMany({
      where: { proposalId: draft.id },
      select: { catalogPositionId: true, billRate: true },
    })

    expect(filas).toHaveLength(3)
    expect(filas.some((f) => f.catalogPositionId === idOf('LAUNDRY'))).toBe(false)
  })

  it('un bill por debajo del pay se rechaza, y el margen cero pasa', async () => {
    const prospectId = await nuevoProspecto()

    await expect(
      proposals.create(
        prospectId,
        {
          rates: [
            { catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '21.85' },
            { catalogPositionId: idOf('HOUSEKEEPER'), payRate: '16.00', billRate: '15.99' },
          ],
        },
        user,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'RATE_MARGIN_NEGATIVE',
        details: [{ field: 'catalogPositionId', value: idOf('HOUSEKEEPER') }],
      },
    })

    // Nada se guardó a medias: el rechazo es antes de abrir la transacción.
    expect(await db.proposal.count({ where: { prospectId } })).toBe(0)

    // El CHECK de la migración es `bill >= pay`: regalar el margen es legal.
    const draft = await proposals.create(
      prospectId,
      { rates: [{ catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '17.00' }] },
      user,
    )

    expect(draft.rates[0]).toMatchObject({ payRate: '17.00', billRate: '17.00' })
  })

  it('dos renglones del mismo puesto se rechazan', async () => {
    const prospectId = await nuevoProspecto()

    await expect(
      proposals.create(
        prospectId,
        {
          rates: [
            { catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '21.85' },
            { catalogPositionId: idOf('CHEF'), payRate: '18.00', billRate: '23.00' },
          ],
        },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'RATE_DUPLICATED' } })
  })

  it('un puesto que no está en el catálogo se rechaza', async () => {
    const prospectId = await nuevoProspecto()
    const fantasma = uuidv7()

    await expect(
      proposals.create(
        prospectId,
        {
          rates: [
            { catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '21.85' },
            { catalogPositionId: fantasma, payRate: '10.00', billRate: '12.00' },
          ],
        },
        user,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'POSITION_NOT_FOUND',
        details: [{ field: 'catalogPositionId', value: fantasma }],
      },
    })
  })

  it('sin un solo puesto cotizado no se envía; con uno sí', async () => {
    const prospectId = await nuevoProspecto()
    const vacia = await proposals.create(prospectId, {}, user)

    expect(vacia.rates).toEqual([])
    expect(vacia.payRate).toBeNull()

    await expect(proposals.send(prospectId, vacia.id, user)).rejects.toMatchObject({
      response: { code: 'PROPOSAL_WITHOUT_RATES' },
    })

    const conCuadro = await proposals.update(
      prospectId,
      vacia.id,
      { rates: [{ catalogPositionId: idOf('HOUSEKEEPER'), payRate: '16.00', billRate: '20.28' }] },
      user,
    )

    expect(conCuadro.rates).toHaveLength(1)

    const enviada = await proposals.send(prospectId, vacia.id, user)

    expect(enviada.sentAt).not.toBeNull()
    expect(enviada.isDraft).toBe(false)
    // El cuadro viaja con lo enviado: es lo que el hotel vio.
    expect(enviada.rates[0]?.position.code).toBe('HOUSEKEEPER')
  })

  it('la unicidad la sostiene el motor: por SQL directo el duplicado rebota contra ux_proposal_rate_position', async () => {
    const prospectId = await nuevoProspecto()
    const draft = await proposals.create(
      prospectId,
      { rates: [{ catalogPositionId: idOf('CHEF'), payRate: '17.00', billRate: '21.85' }] },
      user,
    )

    // Saltándose el servicio —que ya lo atrapa con RATE_DUPLICATED— para
    // comprobar que el índice, y no el código, es lo que impide el duplicado.
    const insertar = (): Promise<number> => db.$executeRaw`
      INSERT INTO commercial.proposal_rate
        (id, proposal_id, catalog_position_id, pay_rate, bill_rate)
      VALUES (${uuidv7()}::uuid, ${draft.id}::uuid, ${idOf('CHEF')}::uuid, 18.00, 23.00)`

    await expect(insertar()).rejects.toThrow(/ux_proposal_rate_position|23505/)

    // Y el cuadro quedó como estaba: el rechazo no dejó basura.
    expect(await db.proposalRate.count({ where: { proposalId: draft.id } })).toBe(1)
  })
})
