import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { DocumentsRepository } from '../../src/modules/personal/documents/documents.repository.js'
import { DocumentsService } from '../../src/modules/personal/documents/documents.service.js'
import { AccessDeadlineService } from '../../src/modules/personal/me/access-deadline.service.js'
import { MeService } from '../../src/modules/personal/me/me.service.js'
import { TaxDeadlineService } from '../../src/modules/personal/me/tax-deadline.service.js'
import { WorkersRepository } from '../../src/modules/personal/workers/workers.repository.js'
import { WorkersService } from '../../src/modules/personal/workers/workers.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Colaborador ve SU historia del semáforo y solo la suya: la ruta no lleva
 * `:id`, sale del token (RR-C-01).
 *
 * Los servicios se arman a mano sobre el cliente compartido; levantar el
 * AppModule abriría un segundo pool de conexiones.
 */

const prisma = db as unknown as PrismaService
// La historia no toca el bucket ni Pub/Sub; los dos van como doble para no
// abrir clientes reales en las pruebas.
const notificationsFake = { publish: (): Promise<void> => Promise.resolve() } as never
const workers = new WorkersService(
  new WorkersRepository(prisma),
  { signedUrl: (): Promise<null> => Promise.resolve(null) } as never,
  new PermissionsService(prisma),
  notificationsFake,
)
const storageFake = { signedUrl: (): Promise<null> => Promise.resolve(null) } as never
const permissions = new PermissionsService(prisma)
const deadline = new TaxDeadlineService(prisma)
const accessDeadline = new AccessDeadlineService(prisma)
const documents = new DocumentsService(
  new DocumentsRepository(prisma),
  storageFake,
  accessDeadline,
  notificationsFake,
)
const me = new MeService(prisma, workers, deadline, documents, notificationsFake, accessDeadline, {
  setPassword: (): Promise<void> => Promise.resolve(),
} as never)

let actorId: string
let zoneId: string
let whiteId: string
let greenId: string
let recruiter: AuthenticatedUser

const users: string[] = []
const workerIds: string[] = []

async function colaborador(email: string): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
  const user = await db.user.create({
    data: { id: uuidv7(), email, fullName: email, roleId: role.id },
    select: { id: true },
  })

  users.push(user.id)

  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      userId: user.id,
      fullName: email,
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

  return { id: user.id, roleCode: 'ROL-C-01' } as AuthenticatedUser
}

/**
 * El SSN/ITIN se unificó con el plazo de "expediente a medias" (2026-09-30):
 * ya no corre desde la primera asignación, corre desde que la Reclutadora
 * valida con la casilla "Validarlo de todas formas". `fillOthers` decide si
 * transporte/emergencia/sangre ya están llenos, para aislar si lo único que
 * falta es el SSN/ITIN.
 */
async function validarIncompleto(workerId: string, fillOthers: boolean): Promise<void> {
  if (fillOthers) {
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
  }

  await workers.changeState(
    workerId,
    { toState: 'STRONG_GREEN', acceptIncompleteProfile: true },
    recruiter,
  )
}

/** El día de gracia (1 día) ya pasó: se suspende sin esperar a que corra de verdad. */
async function venceElPlazo(workerId: string): Promise<void> {
  await db.worker.update({
    where: { id: workerId },
    data: { profileDueAt: new Date(Date.now() - 86_400_000) },
  })
}

async function transicion(workerId: string): Promise<void> {
  await db.workerStateHistory.create({
    data: {
      id: uuidv7(),
      workerId,
      fromStateId: whiteId,
      toStateId: greenId,
      statusLightCode: 'WORKER',
      userId: actorId,
    },
  })
}

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  whiteId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'WHITE', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
  greenId = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id

  const recruiterRole = await db.role.findFirstOrThrow({
    where: { code: 'ROL-R-01' },
    select: { id: true },
  })
  const recruiterUser = await db.user.create({
    data: {
      id: uuidv7(),
      email: `recl-plazo-${String(Date.now())}@oranje.local`,
      fullName: 'Reclutadora de plazo',
      roleId: recruiterRole.id,
    },
    select: { id: true },
  })
  users.push(recruiterUser.id)
  recruiter = { id: recruiterUser.id, roleCode: 'ROL-R-01', hotelId: null, departmentId: null }
})

afterAll(async () => {
  await db.workerDocument.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.workerStateHistory.deleteMany({ where: { workerId: { in: workerIds } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })
  // El journal es inmutable (RR-16) y retiene a quien subió el documento: a ese
  // usuario no se le borra, se le desactiva.
  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    await db.user.updateMany({ where: { id: { in: users } }, data: { isActive: false } })
  }

  await close()
})

describe('la historia propia del Colaborador', () => {
  it('sin transiciones devuelve una lista vacía, no 404', async () => {
    const user = await colaborador(`hist-vacia-${Date.now()}@oranje.local`)

    await expect(me.history(user)).resolves.toEqual([])
  })

  it('devuelve la suya con la forma de /workers/:id/history', async () => {
    const user = await colaborador(`hist-propia-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await transicion(workerId)

    const rows = await me.history(user)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ fromState: 'WHITE', toState: 'STRONG_GREEN' })
    expect(typeof rows[0]?.occurredAt).toBe('string')
    expect(rows[0]?.userName).toBeTruthy()
  })

  it('no ve la de otro colaborador', async () => {
    const ajeno = await colaborador(`hist-ajena-${Date.now()}@oranje.local`)
    const ajenoWorkerId = workerIds[workerIds.length - 1] as string

    await transicion(ajenoWorkerId)
    await transicion(ajenoWorkerId)

    const propio = await colaborador(`hist-mia-${Date.now()}@oranje.local`)

    expect(await me.history(propio)).toEqual([])
    expect(await me.history(ajeno)).toHaveLength(2)
  })

  it('una cuenta sin colaborador ligado no tiene historia que ver', async () => {
    const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
    const suelto = await db.user.create({
      data: {
        id: uuidv7(),
        email: `suelto-${Date.now()}@oranje.local`,
        fullName: 'Suelto',
        roleId: role.id,
      },
      select: { id: true },
    })

    users.push(suelto.id)

    await expect(
      me.history({ id: suelto.id, roleCode: 'ROL-C-01' } as AuthenticatedUser),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_LINKED' } })
  })
})

describe('el Colaborador sube su propio SSN/ITIN', () => {
  it('subirlo cuenta para el plazo: hasDocument pasa a true', async () => {
    const user = await colaborador(`doc-sube-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    const antes = await me.get(user)
    expect(antes.taxDeadline.hasDocument).toBe(false)

    await me.uploadDocument(
      { documentType: 'SSN_ITIN', filePath: 'workers/document/mio.pdf' },
      user,
    )

    const despues = await me.get(user)
    expect(despues.taxDeadline.hasDocument).toBe(true)
    expect(despues.taxDeadline.isDocumentVerified).toBe(false)

    await db.workerDocument.deleteMany({ where: { workerId } })
  })

  // El SSN/ITIN se unificó con el plazo del expediente a medias (2026-09-30):
  // sin haber sido validado así todavía, el plazo no ha arrancado, sin
  // importar cuánto tiempo pasó desde el alta.
  it('sin validar con el expediente a medias, el plazo no ha arrancado aunque el alta sea vieja', async () => {
    const user = await colaborador(`sin-validar-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await db.worker.update({
      where: { id: workerId },
      data: { createdAt: new Date(Date.now() - 30 * 86_400_000) },
    })

    const ficha = await me.get(user)

    expect(ficha.taxDeadline.hasStarted).toBe(false)
    expect(ficha.taxDeadline.status).toBe('OK')
    expect(ficha.taxDeadline.day).toBeNull()
    expect(ficha.taxDeadline.dueAt).toBeNull()
    expect(await accessDeadline.overdueOf(user.id)).not.toContain('PROFILE')
  })

  // La persona se puede equivocar de archivo y no tiene forma de borrarlo.
  it('un segundo intento reemplaza al anterior sin verificar', async () => {
    const user = await colaborador(`doc-reemplaza-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await me.uploadDocument({ documentType: 'SSN_ITIN', filePath: 'workers/document/a.pdf' }, user)
    await me.uploadDocument({ documentType: 'SSN_ITIN', filePath: 'workers/document/b.pdf' }, user)

    const docs = await db.workerDocument.findMany({ where: { workerId } })

    expect(docs).toHaveLength(1)
    expect(docs[0]?.filePath).toBe('workers/document/b.pdf')

    await db.workerDocument.deleteMany({ where: { workerId } })
  })

  it('lo ya verificado no se reemplaza solo', async () => {
    const user = await colaborador(`doc-verificado-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await me.uploadDocument({ documentType: 'SSN_ITIN', filePath: 'workers/document/a.pdf' }, user)
    await db.workerDocument.updateMany({
      where: { workerId },
      data: { verifiedBy: actorId, verifiedAt: new Date() },
    })

    await expect(
      me.uploadDocument({ documentType: 'SSN_ITIN', filePath: 'workers/document/c.pdf' }, user),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_VERIFIED' } })

    await db.workerDocument.deleteMany({ where: { workerId } })
  })

  it('el journal dice que lo subió él', async () => {
    const user = await colaborador(`doc-journal-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    const doc = await me.uploadDocument(
      { documentType: 'SSN_ITIN', filePath: 'workers/document/j.pdf' },
      user,
    )

    const entry = await db.journalEntry.findFirst({
      where: { entityId: doc.id, eventType: 'DOCUMENT_UPLOADED' },
    })

    expect(entry?.payload).toMatchObject({ origin: 'SELF', documentType: 'SSN_ITIN' })

    await db.workerDocument.deleteMany({ where: { workerId } })
  })

  // Sin esto la persona queda encerrada: la unica salida esta detras de la
  // puerta que la falta de SSN/ITIN cerro. El único faltante es el SSN/ITIN
  // (fillOthers=true): así se aisla que subirlo, solo, resuelve el plazo.
  it('vencido el día de gracia, subir el documento le devuelve el acceso', async () => {
    const user = await colaborador(`doc-suspendido-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await validarIncompleto(workerId, true)
    await venceElPlazo(workerId)

    expect(await accessDeadline.overdueOf(user.id)).toContain('PROFILE')

    await me.uploadDocument({ documentType: 'SSN_ITIN', filePath: 'workers/document/s.pdf' }, user)

    expect(await accessDeadline.overdueOf(user.id)).not.toContain('PROFILE')

    await db.workerDocument.deleteMany({ where: { workerId } })
  })

  // El recorrido completo de la salida: ver que estas fuera, subir los bytes y
  // registrar el documento. Si cualquiera de los tres pasos exige acceso, la
  // persona se queda encerrada.
  it('suspendido, las tres rutas de la salida siguen abiertas', async () => {
    const user = await colaborador(`doc-salida-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await validarIncompleto(workerId, true)
    await venceElPlazo(workerId)

    // 1 · ve POR QUÉ está fuera
    expect(await accessDeadline.overdueOf(user.id)).toContain('PROFILE')

    // 2 · los bytes: el destino los acepta por `worker:complete_signup`
    expect(await permissions.can(user.roleCode, 'worker', 'complete_signup')).toBe(true)

    // 3 · registra el documento y vuelve
    await me.uploadDocument({ documentType: 'SSN_ITIN', filePath: 'workers/document/x.pdf' }, user)

    expect(await accessDeadline.overdueOf(user.id)).not.toContain('PROFILE')

    await db.workerDocument.deleteMany({ where: { workerId } })
  })

  // El corazón del cambio del 2026-09-30: si SOLO falta el SSN/ITIN (lo demás
  // ya está lleno), sigue siendo "expediente a medias" — antes de unificar,
  // esto no bloqueaba nada.
  it('con todo lo demás lleno, solo el SSN/ITIN faltante ya cuenta como expediente a medias', async () => {
    const user = await colaborador(`solo-ssn-${Date.now()}@oranje.local`)
    const workerId = workerIds[workerIds.length - 1] as string

    await expect(
      workers.changeState(workerId, { toState: 'STRONG_GREEN' }, recruiter),
    ).rejects.toMatchObject({ response: { code: 'PROFILE_INCOMPLETE' } })

    await validarIncompleto(workerId, true)
    await venceElPlazo(workerId)

    expect(await accessDeadline.overdueOf(user.id)).toContain('PROFILE')
  })

  it('no puede subirle a otro: la ruta no acepta un worker ajeno', async () => {
    const ajeno = await colaborador(`doc-ajeno-${Date.now()}@oranje.local`)
    const ajenoWorkerId = workerIds[workerIds.length - 1] as string
    const propio = await colaborador(`doc-propio-${Date.now()}@oranje.local`)

    await me.uploadDocument(
      { documentType: 'SSN_ITIN', filePath: 'workers/document/p.pdf' },
      propio,
    )

    // El worker sale del token: el documento cayó en el suyo, no en el ajeno.
    expect(await db.workerDocument.count({ where: { workerId: ajenoWorkerId } })).toBe(0)

    void ajeno
    await db.workerDocument.deleteMany({
      where: { workerId: { in: [ajenoWorkerId, workerIds[workerIds.length - 1] as string] } },
    })
  })
})
