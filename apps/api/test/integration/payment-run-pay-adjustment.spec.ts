import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PayAdjustmentsRepository } from '../../src/modules/coverage/pay-adjustments/pay-adjustments.repository.js'
import { PayAdjustmentsService } from '../../src/modules/coverage/pay-adjustments/pay-adjustments.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { PaymentRunsRepository } from '../../src/modules/settlement/payment-runs/payment-runs.repository.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
  lookups,
  makeContract,
  makeHotel,
  makeRequisition,
  makeSchedule,
  makeTimesheet,
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * Que Contabilidad incluya el ajuste/gasto de una eventual es lo que de
 * verdad lo mete en la corrida de pago (Hugo, 2026-10-09): el reembolso se
 * suma al bruto, el descuento se vuelve una deducción propia, y «lo pagó
 * Oranje» no toca nada. Corrida dos veces no debe sumar doble.
 */

const prisma = db as unknown as PrismaService
const permissions = new PermissionsService(prisma)
const payAdjustments = new PayAdjustmentsService(new PayAdjustmentsRepository(prisma), permissions)
const runs = new PaymentRunsRepository(prisma)

const reg: Registry = { rows: [] }
const workers: string[] = []
let actorId: string

function recruiter(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-R-01', hotelId: null, departmentId: null }
}
function observer(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-OBS-01', hotelId: null, departmentId: null }
}
function accountant(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-CO-01', hotelId: null, departmentId: null }
}

async function makeAssignment(params: {
  requisitionId: string
  workerId: string
  startDate: string
  endDate: string
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
  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (
      ${assignmentId}::uuid, ${slotId}::uuid, ${params.workerId}::uuid, 'TEMPORARY',
      daterange(${params.startDate}::date, ${params.endDate}::date, '[)'), 'ACTIVE', ${actorId}::uuid
    )`
  reg.rows.push({ table: 'coverage.assignment', id: assignmentId })

  return assignmentId
}

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

test('el reembolso suma al bruto, el descuento es su propia deducción, el gasto de Oranje no toca nada — y correr dos veces no paga doble', async () => {
  const base = await lookups()
  const hotelId = await makeHotel(reg, {
    label: 'AjusteEnCorrida',
    zoneId: base.zoneId,
    timeZone: 'America/Cancun',
  })
  await makeContract(reg, {
    hotelId,
    positionId: base.positionId,
    payRate: 10,
    validFrom: '2025-01-01',
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
    label: 'AjusteEnCorrida',
  })
  workers.push(workerId)
  const assignmentId = await makeAssignment({
    requisitionId,
    workerId,
    startDate: '2025-06-02',
    endDate: '2025-06-16',
  })
  const scheduleId = await makeSchedule(reg, {
    hotelId,
    weekStart: '2025-06-02',
    weekEnd: '2025-06-08',
    actorId,
  })
  // Un día de 8h brutas - 30min de comida = 7.5h netas, todo regular.
  await makeTimesheet(reg, {
    scheduleId,
    workerId,
    requisitionId,
    weekStart: '2025-06-02',
    weekEnd: '2025-06-08',
    status: 'APPROVED',
    approvedAt: new Date(),
    actorId,
    days: 1,
  })

  const uberId = uuidv7()
  await db.payConcept.create({
    data: { id: uberId, code: `UBER_${uberId.slice(-8)}`, name: 'Uber' },
  })
  reg.rows.push({ table: 'catalogs.pay_concept', id: uberId })

  async function createApproveInclude(dto: {
    payConceptId?: string
    amount: number
    reason: string
    settlementEffect?: 'REIMBURSE' | 'PAYROLL_DEDUCTION' | 'COMPANY_EXPENSE'
  }): Promise<void> {
    const created = await payAdjustments.create(assignmentId, dto, recruiter())
    reg.rows.push({ table: 'coverage.assignment_pay_adjustment', id: created.id })
    await payAdjustments.approve(created.id, observer())
    await payAdjustments.include(created.id, accountant())
  }

  // Ajuste de tarifa: 15.00/hora en vez del 10.00 del contrato.
  await createApproveInclude({ amount: 15, reason: 'tarifa de prueba' })
  // Reembolso: se suma al bruto.
  await createApproveInclude({
    payConceptId: uberId,
    amount: 50,
    reason: 'reembolso de prueba',
    settlementEffect: 'REIMBURSE',
  })
  // Descuento: deducción propia.
  await createApproveInclude({
    payConceptId: uberId,
    amount: 20,
    reason: 'descuento de prueba',
    settlementEffect: 'PAYROLL_DEDUCTION',
  })
  // Gasto de Oranje: no debe tocar nada.
  await createApproveInclude({
    payConceptId: uberId,
    amount: 30,
    reason: 'gasto de oranje de prueba',
    settlementEffect: 'COMPANY_EXPENSE',
  })

  const result = await runs.generate({
    hotelId,
    weekStart: '2025-06-02',
    runAt: new Date(),
    userId: actorId,
    slot: 'TEST',
    runKind: 'REGULAR',
    after: null,
  })
  expect(result).toMatchObject({ created: 1, topped: 0, blocked: 0 })

  const consolidation = await db.consolidation.findFirstOrThrow({
    where: { workerId },
    select: { id: true, grossAmount: true, deductionAmount: true, netAmount: true },
  })
  // 7.5h * 15.00 = 112.50, + 50.00 de reembolso = 162.50 bruto.
  expect(Number(consolidation.grossAmount)).toBe(162.5)
  // Solo el descuento de 20.00 — el gasto de Oranje no es deducción.
  expect(Number(consolidation.deductionAmount)).toBe(20)
  expect(Number(consolidation.netAmount)).toBe(142.5)

  const deductions = await db.deduction.findMany({
    where: { consolidationId: consolidation.id },
    select: { type: true, amount: true, sourceNote: true },
  })
  expect(deductions).toHaveLength(1)
  expect(deductions[0]).toMatchObject({ type: 'PAY_ADJUSTMENT', sourceNote: 'descuento de prueba' })
  expect(Number(deductions[0]?.amount)).toBe(20)

  const adjustmentsAfter = await db.assignmentPayAdjustment.findMany({
    where: { assignmentId },
    select: { settlementEffect: true, appliedAt: true },
  })
  // Las tres que sí pesan quedan marcadas; el gasto de Oranje no se aplica
  // numéricamente a nada, así que no necesita `appliedAt`.
  const applied = adjustmentsAfter.filter((a) => a.appliedAt !== null)
  expect(applied).toHaveLength(3)

  // Correrlo otra vez no debe sumar nada de nuevo.
  const result2 = await runs.generate({
    hotelId,
    weekStart: '2025-06-02',
    runAt: new Date(),
    userId: actorId,
    slot: 'TEST-2',
    runKind: 'REGULAR',
    after: null,
  })
  expect(result2).toMatchObject({ created: 0, topped: 0, blocked: 0 })

  const consolidationAfter2 = await db.consolidation.findUniqueOrThrow({
    where: { id: consolidation.id },
    select: { grossAmount: true, deductionAmount: true, netAmount: true },
  })
  expect(Number(consolidationAfter2.grossAmount)).toBe(162.5)
  expect(Number(consolidationAfter2.deductionAmount)).toBe(20)
  expect(Number(consolidationAfter2.netAmount)).toBe(142.5)

  const deductionsAfter2 = await db.deduction.count({
    where: { consolidationId: consolidation.id },
  })
  expect(deductionsAfter2).toBe(1)
})
