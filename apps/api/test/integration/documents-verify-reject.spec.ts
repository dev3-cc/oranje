import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { DocumentsRepository } from '../../src/modules/personal/documents/documents.repository.js'
import { DocumentsService } from '../../src/modules/personal/documents/documents.service.js'
import { AccessDeadlineService } from '../../src/modules/personal/me/access-deadline.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Reglas de Negocio § Validación con expediente incompleto (Hugo,
 * 2026-09-30): Reclutamiento revisa el SSN/ITIN subido y puede Verificarlo
 * (ya existía) o Rechazarlo con motivo (nuevo) — un rechazo invalida el
 * documento y, si el día de gracia ya pasó, suspende de inmediato.
 */

const prisma = db as unknown as PrismaService
const storageFake = { signedUrl: (): Promise<null> => Promise.resolve(null) } as never
const accessDeadline = new AccessDeadlineService(prisma)
const documents = new DocumentsService(new DocumentsRepository(prisma), storageFake, accessDeadline)

let actorId: string
let zoneId: string
let whiteId: string
const workerIds: string[] = []
const userIds: string[] = []

const reviewer: AuthenticatedUser = {
  id: '',
  roleCode: 'ROL-R-01',
  hotelId: null,
  departmentId: null,
}

beforeAll(async () => {
  actorId = (await actor()).id
  reviewer.id = actorId
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  whiteId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'WHITE', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await db.journalEntry.deleteMany({ where: { entityId: { in: workerIds } } })
  await db.workerDocument.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await close()
})

async function workerConCuenta(etiqueta: string): Promise<{ workerId: string; userId: string }> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' }, select: { id: true } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `${etiqueta}-${String(Date.now())}@oranje.local`,
      fullName: etiqueta,
      roleId: role.id,
    },
    select: { id: true },
  })
  userIds.push(user.id)

  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      userId: user.id,
      fullName: etiqueta,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: whiteId,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
    select: { id: true },
  })
  workerIds.push(worker.id)

  return { workerId: worker.id, userId: user.id }
}

describe('Reclutamiento revisa el SSN/ITIN', () => {
  it('rechazar exige que no esté verificado todavía', async () => {
    const { workerId } = await workerConCuenta('doc-rechazo-verificado')
    const doc = await documents.create(
      workerId,
      { documentType: 'SSN_ITIN', filePath: 'workers/document/a.pdf' },
      reviewer,
    )
    await documents.verify(workerId, doc.id, reviewer)

    await expect(documents.reject(workerId, doc.id, 'ilegible', reviewer)).rejects.toMatchObject({
      response: { code: 'DOCUMENT_VERIFIED' },
    })
  })

  it('rechazar invalida el documento y deja el motivo en el journal', async () => {
    const { workerId } = await workerConCuenta('doc-rechazo-motivo')
    const doc = await documents.create(
      workerId,
      { documentType: 'SSN_ITIN', filePath: 'workers/document/b.pdf' },
      reviewer,
    )

    await documents.reject(workerId, doc.id, 'la foto no se lee', reviewer)

    expect(await db.workerDocument.findUnique({ where: { id: doc.id } })).toBeNull()

    const entry = await db.journalEntry.findFirst({
      where: { entityId: doc.id, eventType: 'DOCUMENT_REJECTED' },
    })
    expect(entry?.payload).toMatchObject({ workerId, reason: 'la foto no se lee' })
  })

  it('rechazado tras el día de gracia, suspende de inmediato', async () => {
    const { workerId, userId } = await workerConCuenta('doc-rechazo-suspende')

    // El resto del expediente ya está — solo el SSN/ITIN sostiene la validación.
    await db.worker.update({
      where: { id: workerId },
      data: {
        transportType: 'PUBLIC',
        emergencyContactName: 'Mamá',
        emergencyContactPhone: '9991112222',
        emergencyContactRelationship: 'MOTHER',
        bloodType: 'O_POS',
      },
    })

    const doc = await documents.create(
      workerId,
      { documentType: 'SSN_ITIN', filePath: 'workers/document/c.pdf' },
      reviewer,
    )

    // Validado a medias (por su cuenta, sin el checkbox: aquí solo importa
    // `profileDueAt`) y con el día de gracia ya vencido.
    await db.worker.update({
      where: { id: workerId },
      data: { profileDueAt: new Date(Date.now() - 86_400_000) },
    })

    expect(await accessDeadline.overdueOf(userId)).not.toContain('PROFILE')

    await documents.reject(workerId, doc.id, 'documento de otra persona', reviewer)

    expect(await accessDeadline.overdueOf(userId)).toContain('PROFILE')
  })

  it('verificar sigue funcionando igual que antes', async () => {
    const { workerId } = await workerConCuenta('doc-verifica')
    const doc = await documents.create(
      workerId,
      { documentType: 'SSN_ITIN', filePath: 'workers/document/d.pdf' },
      reviewer,
    )

    const verified = await documents.verify(workerId, doc.id, reviewer)

    expect(verified.isVerified).toBe(true)
    expect(verified.verifiedBy?.id).toBe(actorId)
  })
})
