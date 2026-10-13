import type { PayAdjustment, SettlementEffect } from '../types/selfPick.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/**
 * El ajuste de tarifa o el gasto extra de una asignación eventual (Hugo,
 * 2026-10-08). Mock mínimo: no conoce el worker/hotel reales detrás de un
 * `assignmentId` (eso lo resuelve el back con sus joins) — aquí basta con
 * que el ciclo PENDING → APROBADO/RECHAZADO se pueda probar de punta a punta.
 */

let seq = 0
const adjustments: PayAdjustment[] = []

const routes: readonly MockRoute[] = [
  {
    method: 'POST',
    path: '/assignments/:assignmentId/pay-adjustments',
    resolve: ({ params, body }): ApiEnvelope<PayAdjustment> => {
      const dto = body as {
        payConceptId?: string
        amount: number
        reason: string
        settlementEffect?: SettlementEffect
      }
      seq += 1
      const row: PayAdjustment = {
        id: `mock-adj-${String(seq)}`,
        assignmentId: params['assignmentId'] ?? '',
        amount: dto.amount.toFixed(2),
        reason: dto.reason,
        status: 'PENDING',
        settlementEffect: dto.settlementEffect ?? null,
        payConcept: dto.payConceptId ? { id: dto.payConceptId, code: 'UBER', name: 'Uber' } : null,
        requestedBy: { id: 'mock-user', fullName: 'Reclutadora de prueba' },
        requestedAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null,
        rejectionReason: null,
        includedBy: null,
        includedAt: null,
        worker: { id: 'mock-worker', fullName: 'Colaborador de prueba' },
        hotelName: 'Hotel de prueba',
        requisitionNumber: 'MOCK-0001',
      }
      adjustments.push(row)
      return { data: row }
    },
  },
  {
    method: 'GET',
    path: '/pay-adjustments/pending',
    resolve: (): ApiEnvelope<PayAdjustment[]> => ({
      data: adjustments.filter((row) => row.status === 'PENDING').map((row) => ({ ...row })),
    }),
  },
  {
    method: 'POST',
    path: '/pay-adjustments/:id/approve',
    resolve: ({ params }): ApiEnvelope<PayAdjustment> => {
      const row = adjustments.find((item) => item.id === params['id'])
      if (!row) throw new Error('Ese ajuste no existe')
      row.status = 'APPROVED'
      row.approvedBy = { id: 'mock-observer', fullName: 'Observador de prueba' }
      row.approvedAt = new Date().toISOString()
      return { data: { ...row } }
    },
  },
  {
    method: 'POST',
    path: '/pay-adjustments/:id/reject',
    resolve: ({ params, body }): ApiEnvelope<PayAdjustment> => {
      const row = adjustments.find((item) => item.id === params['id'])
      if (!row) throw new Error('Ese ajuste no existe')
      const { reason } = body as { reason: string }
      row.status = 'REJECTED'
      row.approvedBy = { id: 'mock-observer', fullName: 'Observador de prueba' }
      row.approvedAt = new Date().toISOString()
      row.rejectionReason = reason
      return { data: { ...row } }
    },
  },
  {
    method: 'GET',
    path: '/pay-adjustments/approved-pending-inclusion',
    resolve: (): ApiEnvelope<PayAdjustment[]> => ({
      data: adjustments
        .filter((row) => row.status === 'APPROVED' && row.includedAt === null)
        .map((row) => ({ ...row })),
    }),
  },
  {
    method: 'POST',
    path: '/pay-adjustments/:id/include',
    resolve: ({ params }): ApiEnvelope<PayAdjustment> => {
      const row = adjustments.find((item) => item.id === params['id'])
      if (!row) throw new Error('Ese ajuste no existe')
      row.includedBy = { id: 'mock-accountant', fullName: 'Contadora de prueba' }
      row.includedAt = new Date().toISOString()
      return { data: { ...row } }
    },
  },
]

let areRoutesRegistered = false

export function registerPayAdjustmentsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}

/** Para pruebas: deja un ajuste PENDING listo, sin pasar por el POST real. */
export function seedPendingPayAdjustment(overrides: Partial<PayAdjustment> = {}): PayAdjustment {
  seq += 1
  const row: PayAdjustment = {
    id: `mock-adj-${String(seq)}`,
    assignmentId: 'mock-assignment',
    amount: '120.00',
    reason: 'Uber de prueba',
    status: 'PENDING',
    settlementEffect: 'REIMBURSE',
    payConcept: { id: 'pc-uber', code: 'UBER', name: 'Uber' },
    requestedBy: { id: 'mock-user', fullName: 'Reclutadora de prueba' },
    requestedAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    includedBy: null,
    includedAt: null,
    worker: { id: 'mock-worker', fullName: 'Colaborador de prueba' },
    hotelName: 'Hotel de prueba',
    requisitionNumber: 'MOCK-0001',
    ...overrides,
  }
  adjustments.push(row)
  return row
}

/** Para pruebas: deja un ajuste APROBADO y sin incluir, listo para Contabilidad. */
export function seedApprovedPendingInclusion(
  overrides: Partial<PayAdjustment> = {},
): PayAdjustment {
  return seedPendingPayAdjustment({
    status: 'APPROVED',
    approvedBy: { id: 'mock-observer', fullName: 'Observador de prueba' },
    approvedAt: new Date().toISOString(),
    ...overrides,
  })
}
