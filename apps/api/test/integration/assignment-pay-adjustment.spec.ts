import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PayAdjustmentsRepository } from '../../src/modules/coverage/pay-adjustments/pay-adjustments.repository.js'
import { PayAdjustmentsService } from '../../src/modules/coverage/pay-adjustments/pay-adjustments.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
  lookups,
  makeHotel,
  makeRequisition,
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * El ajuste de tarifa o el gasto extra (p. ej. «Uber») de una asignación
 * EVENTUAL (Hugo, 2026-10-08): Reclutamiento lo pide, el Observador —única
 * excepción a que es de puro lectura— lo aprueba o lo rechaza, y mientras
 * está PENDING no pesa en nada.
 */

const prisma = db as unknown as PrismaService
const permissions = new PermissionsService(prisma)
const payAdjustments = new PayAdjustmentsService(new PayAdjustmentsRepository(prisma), permissions)

const reg: Registry = { rows: [] }
const workers: string[] = []
let actorId: string

function recruiter(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-R-01', hotelId: null, departmentId: null }
}

function observer(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-OBS-01', hotelId: null, departmentId: null }
}

/** Un slot ocupado por una asignación, FIJA o EVENTUAL según `type`. */
async function makeAssignment(params: {
  requisitionId: string
  workerId: string
  type: 'FIXED' | 'TEMPORARY'
  startDate: string
  endDate?: string
}): Promise<string> {
  const position = await db.position.findFirstOrThrow({
    where: { requisitionId: params.requisitionId },
    select: { id: true },
  })

  const slotId = uuidv7()
  await db.slot.create({
    data: { id: slotId, positionId: position.id, ordinal: 1, status: 'taken' },
  })
  reg.rows.push({ table: 'demand.slot', id: slotId })

  const assignmentId = uuidv7()
  const upper = params.type === 'TEMPORARY' ? (params.endDate ?? '2025-06-16') : null

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (
      ${assignmentId}::uuid, ${slotId}::uuid, ${params.workerId}::uuid, ${params.type},
      daterange(${params.startDate}::date, ${upper}::date, '[)'), 'ACTIVE', ${actorId}::uuid
    )`
  reg.rows.push({ table: 'coverage.assignment', id: assignmentId })

  return assignmentId
}

/** Registra el ajuste creado para la limpieza — DESPUÉS de la asignación en
 * `reg.rows`, para que `cleanup` (que recorre en reversa) lo borre primero y
 * no choque con la FK. */
function trackAdjustment(id: string): void {
  reg.rows.push({ table: 'coverage.assignment_pay_adjustment', id })
}

/** El catálogo está vacío en dev (nadie lo ha sembrado todavía): una fila propia por prueba. */
async function makePayConcept(label: string): Promise<string> {
  const id = uuidv7()
  await db.payConcept.create({ data: { id, code: `TEST_${label.toUpperCase()}`, name: label } })
  reg.rows.push({ table: 'catalogs.pay_concept', id })
  return id
}

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

describe('ajuste/gasto de una asignación eventual', () => {
  it('Reclutamiento lo pide, el Observador lo aprueba, y el permiso del uno no sirve para lo del otro', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'Adjustment',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: '2025-06-02',
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'Adjustment',
    })
    workers.push(workerId)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      type: 'TEMPORARY',
      startDate: '2025-06-02',
    })

    const created = await payAdjustments.create(
      assignmentId,
      { amount: 180, reason: 'Un día a 180 pesos de Uber al hotel' },
      recruiter(),
    )
    trackAdjustment(created.id)
    expect(created).toMatchObject({ status: 'PENDING', amount: '180.00', payConcept: null })

    // El Observador lo ve en SU cola, no solo quien lo pidió.
    const queue = await payAdjustments.pending()
    expect(queue.map((row) => row.id)).toContain(created.id)

    // Reclutamiento no puede aprobar lo suyo: la guarda vive en el permiso
    // (el controller la exige), no en el servicio — un recruiter nunca pasa
    // `requisitions:approve_pay_adjustment`, solo el Observador.
    expect(await permissions.can('ROL-R-01', 'requisitions', 'approve_pay_adjustment')).toBe(false)
    expect(await permissions.can('ROL-OBS-01', 'requisitions', 'approve_pay_adjustment')).toBe(true)

    const approved = await payAdjustments.approve(created.id, observer())
    expect(approved).toMatchObject({ status: 'APPROVED', approvedBy: { id: actorId } })

    // Ya resuelto, no se puede volver a resolver.
    await expect(payAdjustments.approve(created.id, observer())).rejects.toMatchObject({
      response: { code: 'PAY_ADJUSTMENT_ALREADY_RESOLVED' },
    })

    // Y una vez aprobado, sale de la cola de pendientes.
    const queueAfter = await payAdjustments.pending()
    expect(queueAfter.map((row) => row.id)).not.toContain(created.id)
  })

  it('una asignación FIJA no admite el ajuste — solo la eventual', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'AdjustmentFixed',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: '2025-06-02',
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'AdjustmentFixed',
    })
    workers.push(workerId)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      type: 'FIXED',
      startDate: '2025-06-02',
    })

    await expect(
      payAdjustments.create(assignmentId, { amount: 50, reason: 'no debería pasar' }, recruiter()),
    ).rejects.toMatchObject({ response: { code: 'ASSIGNMENT_NOT_TEMPORARY' } })
  })

  it('el gasto con concepto (Uber) lo rechaza el Observador con motivo, y no queda pendiente', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'AdjustmentReject',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: '2025-06-02',
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'AdjustmentReject',
    })
    workers.push(workerId)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      type: 'TEMPORARY',
      startDate: '2025-06-02',
    })
    const uberId = await makePayConcept('Uber de prueba')

    const created = await payAdjustments.create(
      assignmentId,
      {
        payConceptId: uberId,
        amount: 95,
        reason: 'Uber de ida y vuelta',
        settlementEffect: 'REIMBURSE',
      },
      recruiter(),
    )
    trackAdjustment(created.id)
    expect(created.payConcept).toMatchObject({ id: uberId })

    const rejected = await payAdjustments.reject(
      created.id,
      'no procede: el hotel ya lo cubre',
      observer(),
    )
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'no procede: el hotel ya lo cubre',
    })

    const queue = await payAdjustments.pending()
    expect(queue.map((row) => row.id)).not.toContain(created.id)
  })

  it('el gasto exige decir quién lo pagó, y el ajuste de tarifa no lo admite', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'AdjustmentWhoPaid',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: '2025-06-02',
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'AdjustmentWhoPaid',
    })
    workers.push(workerId)
    const assignmentId = await makeAssignment({
      requisitionId,
      workerId,
      type: 'TEMPORARY',
      startDate: '2025-06-02',
    })
    const uberId = await makePayConcept('Uber sin disposicion')

    // El gasto (con concepto) sin decir quién pagó: rechazado.
    await expect(
      payAdjustments.create(
        assignmentId,
        { payConceptId: uberId, amount: 60, reason: 'Uber al hotel' },
        recruiter(),
      ),
    ).rejects.toMatchObject({ response: { code: 'SETTLEMENT_EFFECT_REQUIRED' } })

    // El ajuste de tarifa (sin concepto) con un `settlementEffect`: tampoco
    // tiene sentido — no hay de quién reembolsar o descontar.
    await expect(
      payAdjustments.create(
        assignmentId,
        { amount: 2, reason: 'ajuste de tarifa', settlementEffect: 'REIMBURSE' },
        recruiter(),
      ),
    ).rejects.toMatchObject({ response: { code: 'SETTLEMENT_EFFECT_NOT_APPLICABLE' } })

    // Las tres disposiciones válidas: cada una se guarda tal cual.
    for (const effect of ['REIMBURSE', 'COMPANY_EXPENSE', 'PAYROLL_DEDUCTION'] as const) {
      const created = await payAdjustments.create(
        assignmentId,
        { payConceptId: uberId, amount: 10, reason: `Uber — ${effect}`, settlementEffect: effect },
        recruiter(),
      )
      trackAdjustment(created.id)
      expect(created.settlementEffect).toBe(effect)
    }
  })
})
