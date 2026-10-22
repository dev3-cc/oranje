import { v7 as uuidv7 } from 'uuid'

import { PERMISSIONS } from '../../prisma/permissions.js'
import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { AuditsRepository } from '../../src/modules/supervision/audits/audits.repository.js'
import { AuditsService } from '../../src/modules/supervision/audits/audits.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Las dos inspecciones del Inspector: Presentación Personal (por colaborador) y
 * Percepción de Ambiente y Recursos (por hotel), mismo mecanismo. Nació del
 * Supervisor (2026-09-14), se amplió al Inspector por zona (2026-09-24) y
 * quedó EXCLUSIVA del Inspector el 2026-10-21 (el vault ya lo pedía desde el
 * 2026-10-16) — el Supervisor pierde create/read/update por completo, ver
 * `audits.service.ts`. Sin efecto en semáforos y sin journal — su historial
 * es `audit_response_history`.
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
let otherZoneId: string
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

// `zone` por defecto es la zona primaria del archivo; `otherHotelId` pasa la
// suya para poder probar el límite real del Inspector (zona, no hotel).
async function hotel(name: string, zone: string = zoneId): Promise<string> {
  const id = uuidv7()

  await db.hotel.create({
    data: {
      id,
      name: `${name} ${id.slice(-8)}`,
      zoneId: zone,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })

  hotels.push(id)

  return id
}

// Fixture para roles con hotel fijo (Supervisor, Manager de Área/General):
// sigue haciendo falta para la inspección de "la Matriz" (el Supervisor ya
// rechazado) y para el caso del Manager General sin hotel.
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

// El Inspector no tiene hotel fijo: inspecciona los hoteles de la(s) zona(s) que
// se le asignen (`commercial.user_zone`) — mismo patrón que
// `audits-inspector.spec.ts` y `RequisitionsRepository`.
async function inspector(zoneIds: string[]): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-I-01' } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `audit-inspector-${uuidv7().slice(-12)}@oranje.local`,
      fullName: 'ROL-I-01',
      roleId: role.id,
    },
    select: { id: true },
  })

  users.push(user.id)

  await db.userZone.createMany({ data: zoneIds.map((zone) => ({ userId: user.id, zoneId: zone })) })

  return { id: user.id, roleCode: 'ROL-I-01', hotelId: null, departmentId: null }
}

async function colaborador(): Promise<string> {
  const state = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: `Inspeccionado ${Date.now()}${Math.floor(Math.random() * 1000)}`,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000002',
      address: 'Calle Inspección',
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
  otherZoneId = (
    await db.zone.findFirstOrThrow({ where: { id: { not: zoneId } }, select: { id: true } })
  ).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id

  hotelId = await hotel('Hotel Inspecciones')
  // En OTRA zona a propósito: el límite real del Inspector es su zona, no un
  // hotel ajeno dentro de la misma (2026-10-21).
  otherHotelId = await hotel('Hotel Ajeno Inspecciones', otherZoneId)

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

  await db.userZone.deleteMany({ where: { userId: { in: users } } })

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

describe('crear una inspección', () => {
  it('Presentación Personal calcula el score ponderado', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

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
      inspectorDeLaZona,
    )
    auditIds.push(entity.id)

    // earned = 1, possible = 1 + 3 = 4 → 25.00
    expect(entity.score).toBe('25.00')
    expect(entity.worker?.id).toBe(workerId)
    expect(entity.responses).toHaveLength(2)
  })

  it('Ambiente y Recursos no lleva colaborador', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    const entity = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [
          { checklistItemId: envItemA, value: 'CUMPLE' },
          { checklistItemId: envItemB, value: 'CUMPLE' },
        ],
      },
      inspectorDeLaZona,
    )
    auditIds.push(entity.id)

    expect(entity.score).toBe('100.00')
    expect(entity.worker).toBeNull()
  })

  it('N/A no cuenta ni pesa en el promedio', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    const entity = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [
          { checklistItemId: envItemA, value: 'CUMPLE' }, // weight 1, cuenta
          { checklistItemId: envItemB, value: 'N/A' }, // weight 2, fuera del cálculo
        ],
      },
      inspectorDeLaZona,
    )
    auditIds.push(entity.id)

    // possible = 1 (solo A), earned = 1 → 100.00
    expect(entity.score).toBe('100.00')
  })

  it('todos N/A se rechaza: no hay nada que calificar', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId,
          responses: [{ checklistItemId: envItemA, value: 'N/A' }],
        },
        inspectorDeLaZona,
      ),
    ).rejects.toMatchObject({ response: { code: 'AUDIT_ALL_NA' } })
  })

  it('un Inspector de OTRA zona recibe 403 (HOTEL_OUT_OF_ZONE)', async () => {
    const ajeno = await inspector([otherZoneId])

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId,
          responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
        },
        ajeno,
      ),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_ZONE' } })
  })

  it('PERSONAL_PRESENTATION exige workerId', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    await expect(
      audits.create(
        {
          auditType: 'PERSONAL_PRESENTATION',
          hotelId,
          responses: [{ checklistItemId: ppItemA, value: 'CUMPLE' }],
        },
        inspectorDeLaZona,
      ),
    ).rejects.toMatchObject({ response: { code: 'WORKER_REQUIRED' } })
  })

  it('ENVIRONMENT rechaza workerId', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    await expect(
      audits.create(
        {
          auditType: 'ENVIRONMENT',
          hotelId,
          workerId,
          responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
        },
        inspectorDeLaZona,
      ),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_ALLOWED' } })
  })

  it('un colaborador sin asignación activa en ese hotel se rechaza', async () => {
    const inspectorDeLaZona = await inspector([zoneId])
    const suelto = await colaborador()

    await expect(
      audits.create(
        {
          auditType: 'PERSONAL_PRESENTATION',
          hotelId,
          workerId: suelto,
          responses: [{ checklistItemId: ppItemA, value: 'CUMPLE' }],
        },
        inspectorDeLaZona,
      ),
    ).rejects.toMatchObject({ response: { code: 'WORKER_NOT_ASSIGNED_TO_HOTEL' } })
  })
})

describe('corregir una inspección', () => {
  it('corregir una respuesta deja historia y recalcula el score', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [
          { checklistItemId: envItemA, value: 'NO' }, // weight 1
          { checklistItemId: envItemB, value: 'NO' }, // weight 2
        ],
      },
      inspectorDeLaZona,
    )
    auditIds.push(created.id)

    expect(created.score).toBe('0.00')

    const corrected = await audits.update(
      created.id,
      { responses: [{ checklistItemId: envItemB, value: 'CUMPLE' }] },
      inspectorDeLaZona,
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
    const inspectorDeLaZona = await inspector([zoneId])

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      inspectorDeLaZona,
    )
    auditIds.push(created.id)

    await audits.update(
      created.id,
      { responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }] },
      inspectorDeLaZona,
    )

    const responseRow = await db.auditResponse.findFirstOrThrow({
      where: { auditId: created.id, checklistItemId: envItemA },
    })
    const history = await db.auditResponseHistory.findMany({
      where: { auditResponseId: responseRow.id },
    })

    expect(history).toHaveLength(0)
  })

  it('un Inspector de otra zona no corrige', async () => {
    const inspectorDeLaZona = await inspector([zoneId])
    const ajeno = await inspector([otherZoneId])

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      inspectorDeLaZona,
    )
    auditIds.push(created.id)

    await expect(
      audits.update(created.id, { observations: 'intento ajeno' }, ajeno),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_ZONE' } })
  })
})

describe('tiempo sin inspeccionar', () => {
  it('un colaborador inspeccionado trae fecha y uno nunca inspeccionado trae null', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    const created = await audits.create(
      {
        auditType: 'PERSONAL_PRESENTATION',
        hotelId,
        workerId,
        responses: [{ checklistItemId: ppItemA, value: 'CUMPLE' }],
      },
      inspectorDeLaZona,
    )
    auditIds.push(created.id)

    const rows = await audits.lastPerWorker(hotelId, inspectorDeLaZona)

    const audited = rows.find((r) => r.workerId === workerId)
    const never = rows.find((r) => r.workerId === unauditedWorkerId)

    expect(audited?.lastAuditedAt).not.toBeNull()
    expect(never?.lastAuditedAt).toBeNull()
  })

  // No es sobre el permiso de Inspecciones (el GM nunca lo tuvo, con o sin el
  // cambio del 2026-10-21): es el caso borde de `assertHotelScope` para
  // cualquier usuario sin hotel fijo Y sin zonas asignadas (mismo camino que
  // Sistema) — el GM solo presta el `hotelId: null`.
  it('un Manager General (sin hotel) también puede consultarla', async () => {
    const gm = await usuario('ROL-H-03', null)

    await expect(audits.lastPerWorker(hotelId, gm)).resolves.toEqual(expect.any(Array))
  })
})

describe('leer inspecciones', () => {
  it('el detalle trae las respuestas con categoría y etiqueta del reactivo', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      inspectorDeLaZona,
    )
    auditIds.push(created.id)

    const detail = await audits.get(created.id, inspectorDeLaZona)

    expect(detail.responses[0]).toMatchObject({
      checklistItemId: envItemA,
      category: 'Insumos',
      value: 'CUMPLE',
    })
  })

  it('la lista respeta el alcance de zona del Inspector: incluye la suya, no la ajena', async () => {
    const inspectorDeLaZona = await inspector([zoneId])

    const created = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      inspectorDeLaZona,
    )
    auditIds.push(created.id)

    // Una inspección de un hotel de OTRA zona, hecha por su propio Inspector:
    // no debe aparecer en el tablero del primero.
    const inspectorDeOtraZona = await inspector([otherZoneId])
    const deOtraZona = await audits.create(
      {
        auditType: 'ENVIRONMENT',
        hotelId: otherHotelId,
        responses: [{ checklistItemId: envItemA, value: 'CUMPLE' }],
      },
      inspectorDeOtraZona,
    )
    auditIds.push(deOtraZona.id)

    const board = await audits.list({ page: 1, limit: 50 }, inspectorDeLaZona)
    const ids = board.data.map((a) => a.id)

    expect(ids).toContain(created.id)
    expect(ids).not.toContain(deOtraZona.id)
  })
})

describe('la Matriz sostiene audits:create/read/update', () => {
  // Contra `PERMISSIONS` (la fuente en `prisma/permissions.ts`), no contra
  // `PermissionsService`/`role_permission`: esta base de pruebas local no se
  // resembró con el cambio del 2026-10-21 (seguía dando ROL-H-01 → true antes
  // de este archivo), y reseeder aquí habría destapado además una fila
  // desactualizada en `herencia-jerarquia.spec.ts` (línea ~126, hardcodea
  // ROL-H-01 en el set de audits) que no me corresponde tocar. Esto prueba
  // exactamente lo mismo que probaba el bloque anterior —quién sostiene la
  // Matriz— leyendo la fuente de verdad en vez de una base que puede quedar
  // detrás de ella.
  const filasAudits = new Map(
    PERMISSIONS.filter((p) => p.module === 'audits').map((p) => [p.action, p]),
  )

  it('solo el Inspector inspecciona, corrige y ve: el Supervisor ya NO (exclusividad del 2026-10-21)', () => {
    for (const action of ['create', 'read', 'update'] as const) {
      const fila = filasAudits.get(action)

      expect(fila?.inherit).toBe(false)
      expect(fila?.roles).toContain('ROL-I-01')
      expect(fila?.roles).not.toContain('ROL-H-01') // el Supervisor lo tenía hasta el 2026-10-21
    }
  })

  it('sigue sin heredarse: ni los Managers del hotel ni el Coordinador del Inspector', () => {
    for (const action of ['create', 'read', 'update'] as const) {
      const roles = filasAudits.get(action)?.roles ?? []

      expect(roles).not.toContain('ROL-H-02') // Manager de Área
      expect(roles).not.toContain('ROL-H-03') // Manager General
      expect(roles).not.toContain('ROL-I-02') // Coordinador ⊃ Inspector, pero esto es `inherit: false`
    }
  })

  it('crear y corregir son exclusivos del Inspector; leer también lo abre el Sistema', () => {
    expect(filasAudits.get('create')?.roles).toEqual(['ROL-I-01'])
    expect(filasAudits.get('update')?.roles).toEqual(['ROL-I-01'])
    expect(new Set(filasAudits.get('read')?.roles)).toEqual(new Set(['ROL-I-01', 'ROL-SYS-01']))
  })
})
