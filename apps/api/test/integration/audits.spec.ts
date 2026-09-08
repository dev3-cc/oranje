import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { AuditsRepository } from '../../src/modules/supervision/audits/audits.repository.js'
import { AuditsService } from '../../src/modules/supervision/audits/audits.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Las dos auditorías del Supervisor: Presentación Personal (por colaborador) y
 * Percepción de Ambiente y Recursos (por hotel), mismo mecanismo. Sin efecto
 * en semáforos y sin journal — su historial es `audit_response_history`.
 */

const prisma = db as unknown as PrismaService

// El bucket no se toca: lo que fija el contrato es que la foto llega firmada
// al leer (D-30), igual que en `staff-users.spec.ts`.
const storageFake = {
  signedUrl: jest.fn((path: string) => Promise.resolve(`https://firmada.local/${path}`)),
}

const audits = new AuditsService(
  new AuditsRepository(prisma),
  storageFake as unknown as StorageService,
)

let actorId: string
let zoneId: string
let departmentId: string
let positionId: string
let modalityId: string

let hotelId: string
let otherHotelId: string
let workerId: string
let unauditedWorkerId: string

let ppItemA: string
let ppItemB: string
let envItemA: string
let envItemB: string

const users: string[] = []
const hotels: string[] = []
const requisitions: string[] = []
const workerIds: string[] = []
const auditIds: string[] = []
const checklistItemIds: string[] = []

async function hotel(name: string): Promise<string> {
  const id = uuidv7()

  await db.hotel.create({
    data: {
      id,
      name: `${name} ${id.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })

  hotels.push(id)

  return id
}

async function usuario(roleCode: string, scopeHotelId: string | null): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `audit-${uuidv7().slice(-12)}@oranje.local`,
      fullName: roleCode,
      roleId: role.id,
      hotelId: scopeHotelId,
    },
    select: { id: true },
  })

  users.push(user.id)

  return { id: user.id, roleCode, hotelId: scopeHotelId, departmentId: null }
}

async function colaborador(): Promise<string> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: `Auditado ${Date.now()}${Math.floor(Math.random() * 1000)}`,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000002',
      address: 'Calle Auditoría',
      zoneId,
      statusLightStateId: state.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
    select: { id: true },
  })

  workerIds.push(worker.id)

  return worker.id
}

// Lo pone a trabajar en ese hotel: es lo que le da alcance (mismo patrón que
// `WorkersRepository.isAssignedToHotel`, cruzando coverage/demand/hotel).
async function asignar(worker: string, hotel: string): Promise<void> {
  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `AU${Date.now()}${Math.floor(Math.random() * 100)}`,
      hotelId: hotel,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: actorId,
    },
    select: { id: true },
  })

  requisitions.push(requisition.id)

  const position = await db.position.create({
    data: {
      id: uuidv7(),
      requisitionId: requisition.id,
      lineNumber: 1,
      catalogPositionId: positionId,
      hiringModalityId: modalityId,
      hotelDepartmentId: departmentId,
      quantity: 1,
      startDate: new Date(),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })

  const slot = await db.slot.create({
    data: { id: uuidv7(), positionId: position.id, ordinal: 1 },
    select: { id: true },
  })

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${uuidv7()}::uuid, ${slot.id}::uuid, ${worker}::uuid, 'FIXED',
            daterange(current_date - 1, NULL), 'ACTIVE', ${actorId}::uuid)`
}

async function checklistItem(
  auditType: string,
  category: string,
  label: string,
  weight: number,
  ordinal: number,
): Promise<string> {
  const id = uuidv7()

  await db.auditChecklistItem.create({
    data: { id, auditType, category, code: `TEST_${id.slice(-12)}`, label, weight, ordinal },
  })

  checklistItemIds.push(id)

  return id
}

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id

  hotelId = await hotel('Hotel Auditorías')
  otherHotelId = await hotel('Hotel Ajeno Auditorías')

  workerId = await colaborador()
  await asignar(workerId, hotelId)

  unauditedWorkerId = await colaborador()
  await asignar(unauditedWorkerId, hotelId)

  ppItemA = await checklistItem('PERSONAL_PRESENTATION', 'Uniformidad', 'Item de prueba A', 1, 1)
  ppItemB = await checklistItem('PERSONAL_PRESENTATION', 'Uniformidad', 'Item de prueba B', 3, 2)
  envItemA = await checklistItem('ENVIRONMENT', 'Insumos', 'Item ambiente A', 1, 1)
  envItemB = await checklistItem('ENVIRONMENT', 'Insumos', 'Item ambiente B', 2, 2)
})

afterAll(async () => {
  await db.auditResponseHistory.deleteMany({
    where: { auditResponse: { auditId: { in: auditIds } } },
  })
  await db.auditResponse.deleteMany({ where: { auditId: { in: auditIds } } })
  await db.audit.deleteMany({ where: { id: { in: auditIds } } })
  await db.auditChecklistItem.deleteMany({ where: { id: { in: checklistItemIds } } })

  await db.$executeRaw`DELETE FROM coverage.assignment WHERE worker_id = ANY(${workerIds}::uuid[])`
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitions } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitions } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitions } } })
  await db.worker.deleteMany({ where: { id: { in: workerIds } } })

  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    await db.user.updateMany({
      where: { id: { in: users } },
      data: { isActive: false, hotelId: null },
    })
  }

  await db.hotel.deleteMany({ where: { id: { in: hotels } } })

  await close()
})

describe('crear una auditoría', () => {
  it('Presentación Personal calcula el score ponderado', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const entity = await audits.create(
      {
        auditType: 'PERSONAL_PRESENTATION',
        hotelId,
        workerId,
        responses: [
          { checklistItemId: ppItemA, value: 'CUMPLE' }, // weight 1
          { checklistItemId: ppItemB, value: 'NO' }, // weight 3
        ],
      },
      supervisor,
    )
    auditIds.push(entity.id)

    // earned = 1, possible = 1 + 3 = 4 → 25.00
    expect(entity.score).toBe('25.00')
    expect(entity.worker?.id).toBe(workerId)
    expect(entity.responses).toHaveLength(2)
  })

  it('Ambiente y Recursos no lleva colaborador', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const entity = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [
          { checklistItemId: envItemA, value: 'CUMPLE' },
          { checklistItemId: envItemB, value: 'CUMPLE' },
        ],
      },
      supervisor,
    )
    auditIds.push(entity.id)

    expect(entity.score).toBe('100.00')
    expect(entity.worker).toBeNull()
  })

  it('N/A no cuenta ni pesa en el promedio', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const entity = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [
          { checklistItemId: envItemA, value: 'CUMPLE' }, // weight 1, cuenta
          { checklistItemId: envItemB, value: 'N/A' }, // weight 2, fuera del cálculo
        ],
      },
      supervisor,
    )
    auditIds.push(entity.id)

    // possible = 1 (solo A), earned = 1 → 100.00
    expect(entity.score).toBe('100.00')
  })

  it('todos N/A se rechaza: no hay nada que calificar', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId,
          responses: [{ checklistItemId: envItemA, value: 'N/A' }],
        },
        supervisor,
      ),
    ).rejects.toMatchObject({ response: { code: 'AUDIT_ALL_NA' } })
  })

  it('un Supervisor de OTRO hotel recibe 403', async () => {
    const ajeno = await usuario('ROL-H-01', otherHotelId)

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId,
          responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
        },
        ajeno,
      ),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_SCOPE' } })
  })

  it('PERSONAL_PRESENTATION exige workerId', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    await expect(
      audits.create(
        {
          auditType: 'PERSONAL_PRESENTATION',
          hotelId,
          responses: [{ checklistItemId: ppItemA, value: 'CUMPLE' }],
        },
        supervisor,
      ),
    ).rejects.toMatchObject({ response: { code: 'WORKER_REQUIRED' } })
  })

  it('ENVIRONMENT rechaza workerId', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId,
          workerId,
          responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
        },
        supervisor,
      ),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_ALLOWED' } })
  })

  it('un colaborador sin asignación activa en ese hotel se rechaza', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)
    const suelto = await colaborador()

    await expect(
      audits.create(
        {
          auditType: 'PERSONAL_PRESENTATION',
          hotelId,
          workerId: suelto,
          responses: [{ checklistItemId: ppItemA, value: 'CUMPLE' }],
        },
        supervisor,
      ),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_ASSIGNED_TO_HOTEL' } })
  })
})

describe('corregir una auditoría', () => {
  it('corregir una respuesta deja historia y recalcula el score', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [
          { checklistItemId: envItemA, value: 'NO' }, // weight 1
          { checklistItemId: envItemB, value: 'NO' }, // weight 2
        ],
      },
      supervisor,
    )
    auditIds.push(created.id)

    expect(created.score).toBe('0.00')

    const corrected = await audits.update(
      created.id,
      { responses: [{ checklistItemId: envItemB, value: 'CUMPLE' }] },
      supervisor,
    )

    // possible = 1 + 2 = 3, earned = 2 → 66.67
    expect(corrected.score).toBe('66.67')

    const responseRow = await db.auditResponse.findFirstOrThrow({
      where: { auditId: created.id, checklistItemId: envItemB },
    })
    const history = await db.auditResponseHistory.findMany({
      where: { auditResponseId: responseRow.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ previousValue: 'NO', newValue: 'CUMPLE' })
  })

  it('mandar el mismo valor no deja historia', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      supervisor,
    )
    auditIds.push(created.id)

    await audits.update(
      created.id,
      { responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }] },
      supervisor,
    )

    const responseRow = await db.auditResponse.findFirstOrThrow({
      where: { auditId: created.id, checklistItemId: envItemA },
    })
    const history = await db.auditResponseHistory.findMany({
      where: { auditResponseId: responseRow.id },
    })

    expect(history).toHaveLength(0)
  })

  it('un Supervisor de otro hotel no corrige', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)
    const ajeno = await usuario('ROL-H-01', otherHotelId)

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      supervisor,
    )
    auditIds.push(created.id)

    await expect(
      audits.update(created.id, { observations: 'intento ajeno' }, ajeno),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_SCOPE' } })
  })
})

describe('tiempo sin auditar', () => {
  it('un colaborador auditado trae fecha y uno nunca auditado trae null', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const created = await audits.create(
      {
        auditType: 'PERSONAL_PRESENTATION',
        hotelId,
        workerId,
        responses: [{ checklistItemId: ppItemA, value: 'CUMPLE' }],
      },
      supervisor,
    )
    auditIds.push(created.id)

    const rows = await audits.lastPerWorker(hotelId, supervisor)

    const audited = rows.find((r) => r.workerId === workerId)
    const never = rows.find((r) => r.workerId === unauditedWorkerId)

    expect(audited?.lastAuditedAt).not.toBeNull()
    expect(never?.lastAuditedAt).toBeNull()
  })

  it('un Manager General (sin hotel) también puede consultarla', async () => {
    const gm = await usuario('ROL-H-03', null)

    await expect(audits.lastPerWorker(hotelId, gm)).resolves.toEqual(expect.any(Array))
  })
})

describe('leer auditorías', () => {
  it('el detalle trae las respuestas con categoría y etiqueta del reactivo', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      supervisor,
    )
    auditIds.push(created.id)

    const detail = await audits.get(created.id, supervisor)

    expect(detail.responses[0]).toMatchObject({
      checklistItemId: envItemA,
      category: 'Insumos',
      value: 'CUMPLE',
    })
  })

  it('la lista respeta el alcance de hotel del Supervisor', async () => {
    const supervisor = await usuario('ROL-H-01', hotelId)

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      supervisor,
    )
    auditIds.push(created.id)

    const board = await audits.list({ page: 1, limit: 50 }, supervisor)

    expect(board.data.some((a) => a.id === created.id)).toBe(true)
  })
})

describe('la Matriz sostiene audits:update', () => {
  it('solo el Supervisor corrige', async () => {
    const permissions = new PermissionsService(prisma)

    expect(await permissions.can('ROL-H-01', 'audits', 'update')).toBe(true)
    expect(await permissions.can('ROL-H-02', 'audits', 'update')).toBe(false)
    expect(await permissions.can('ROL-H-03', 'audits', 'update')).toBe(false)
  })
})
