import { v7 as uuidv7 } from 'uuid'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El reparto de fases del 2026-08-22: posición, modalidad, inglés y
 * experiencia son DECISIONES DE ORANJE y las captura la Reclutadora en la
 * entrevista; de la Fase 2 solo queda el transporte.
 *
 * Lo que se protege aquí es que la fila pueda nacer a medias — eso ES el
 * estado Blanco — y que `is_profile_complete` siga exigiendo los nueve.
 */

let actorId: string
let zoneId: string
let whiteId: string
const workers: string[] = []

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  whiteId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'WHITE', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.workerStateHistory.deleteMany({ where: { workerId: { in: workers } } })
  await db.worker.deleteMany({ where: { id: { in: workers } } })
  await close()
})

async function worker(data: Record<string, unknown> = {}): Promise<string> {
  const id = uuidv7()

  await db.worker.create({
    data: {
      id,
      fullName: 'Fases',
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: whiteId,
      statusLightCode: 'WORKER',
      createdBy: actorId,
      ...data,
    },
  })

  workers.push(id)

  return id
}

async function view(id: string): Promise<{ is_profile_complete: boolean; has_tax_id: boolean }> {
  const rows = await db.$queryRaw<Array<{ is_profile_complete: boolean; has_tax_id: boolean }>>`
    SELECT is_profile_complete, has_tax_id FROM personal.vw_worker WHERE id = ${id}::uuid`

  return rows[0] as { is_profile_complete: boolean; has_tax_id: boolean }
}

describe('el alta por fases', () => {
  it('la Fase 1 sola deja el perfil incompleto', async () => {
    const id = await worker()

    expect((await view(id)).is_profile_complete).toBe(false)
  })

  it('con las cuatro decisiones de Oranje sigue incompleto: falta lo del colaborador', async () => {
    const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
    const english = await db.englishLevel.findFirstOrThrow({ select: { id: true } })
    const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })

    const id = await worker({
      catalogPositionId: position.id,
      englishLevelId: english.id,
      hiringModalityId: modality.id,
      experienceLevel: 'THREE_TO_FIVE',
    })

    expect((await view(id)).is_profile_complete).toBe(false)
  })

  it('se completa con el transporte y los datos de emergencia', async () => {
    const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
    const english = await db.englishLevel.findFirstOrThrow({ select: { id: true } })
    const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })

    const id = await worker({
      catalogPositionId: position.id,
      englishLevelId: english.id,
      hiringModalityId: modality.id,
      experienceLevel: 'THREE_TO_FIVE',
      transportType: 'OWN',
      emergencyContactName: 'Rosa',
      emergencyContactPhone: '9992223344',
      emergencyContactRelationship: 'MOTHER',
      bloodType: 'A_POS',
    })

    expect((await view(id)).is_profile_complete).toBe(true)
  })

  // D-27: mientras el cifrado de campo no se conecte, la retención del 16%
  // aplica a todos, tengan documento o no.
  it('has_tax_id sigue en falso aunque el expediente tenga el documento', async () => {
    const id = await worker()

    await db.workerDocument.create({
      data: {
        id: uuidv7(),
        workerId: id,
        documentType: 'SSN_ITIN',
        filePath: 'workers/document/x.pdf',
        verifiedBy: actorId,
        verifiedAt: new Date(),
      },
    })

    expect((await view(id)).has_tax_id).toBe(false)

    await db.workerDocument.deleteMany({ where: { workerId: id } })
  })
})
