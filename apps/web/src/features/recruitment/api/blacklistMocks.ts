import { mockWorkerName, mockWorkerState, registerPoolMocks } from './poolMocks'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, BlacklistEntryApi } from '@/shared/types/apiContract.types'

/**
 * Fixtures de `coverage.blacklist_entry` en la forma CRUDA del contrato real.
 * Los tres casos de la maqueta: dos vetos manuales vigentes y uno del sistema
 * ya levantado — el historial no se borra.
 */

const entries: BlacklistEntryApi[] = [
  {
    id: 'bl-0001',
    worker: { id: 'wrk-0101', fullName: 'Carlos Beltrán' },
    source: 'MANUAL',
    reason: 'Abandonó el turno sin aviso en dos ocasiones',
    evidencePath: 'evidencia.pdf',
    occurredAt: '2026-08-02',
    isActive: true,
    enteredBy: { id: 'usr-diana', fullName: 'Diana Roldán' },
    liftedAt: null,
    liftedBy: null,
    liftReason: null,
  },
  {
    id: 'bl-0002',
    worker: { id: 'wrk-0102', fullName: 'Norma Estrada' },
    source: 'MANUAL',
    reason: 'Documentación falsificada en el alta',
    evidencePath: 'acta.pdf',
    occurredAt: '2026-07-21',
    isActive: true,
    enteredBy: { id: 'usr-salas', fullName: 'M. Salas' },
    liftedAt: null,
    liftedBy: null,
    liftReason: null,
  },
  {
    id: 'bl-0003',
    worker: { id: 'wrk-0103', fullName: 'Pedro Quiroz' },
    source: 'ABSENCES',
    reason: '3 ausencias en 30 días',
    evidencePath: null,
    occurredAt: '2026-06-14',
    isActive: false,
    enteredBy: { id: 'usr-sys', fullName: 'Sistema' },
    liftedAt: '2026-07-01',
    liftedBy: { id: 'usr-admin', fullName: 'Administrador' },
    liftReason: 'Acuerdo con el hotel; reincorporación autorizada.',
  },
]

let entrySequence = 3

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/workers/:workerId/blacklist',
    resolve: ({ params }): ApiEnvelope<BlacklistEntryApi[]> => ({
      data: entries.filter((entry) => entry.worker.id === params.workerId),
    }),
  },
  {
    method: 'POST',
    path: '/workers/:workerId/blacklist',
    resolve: ({ params, body }): ApiEnvelope<BlacklistEntryApi> => {
      const payload = (body ?? {}) as { source?: string; reason?: string; evidencePath?: string }
      const workerId = params.workerId ?? ''
      if (!payload.reason) throw new Error('El motivo es obligatorio')
      if (payload.source === 'MANUAL' && !payload.evidencePath) {
        throw new Error('Un veto manual necesita evidencia')
      }
      /** El GRIS protege: el motor rechaza vetar a un accidentado (D-27). */
      if (mockWorkerState(workerId) === 'GRAY') {
        throw new Error('WORKER_PROTECTED: un colaborador accidentado no se puede vetar')
      }
      /** `ux_blacklist_worker`: un solo veto vigente. */
      if (entries.some((entry) => entry.worker.id === workerId && entry.isActive)) {
        throw new Error('BLACKLIST_ALREADY_ACTIVE: ya hay un veto vigente')
      }
      entrySequence += 1
      const created: BlacklistEntryApi = {
        id: `bl-${String(entrySequence).padStart(4, '0')}`,
        worker: { id: workerId, fullName: mockWorkerName(workerId) },
        source: payload.source ?? 'MANUAL',
        reason: payload.reason,
        evidencePath: payload.evidencePath ?? null,
        occurredAt: new Date().toISOString().slice(0, 10),
        isActive: true,
        enteredBy: { id: 'usr-diana', fullName: 'Diana Roldán' },
        liftedAt: null,
        liftedBy: null,
        liftReason: null,
      }
      entries.unshift(created)
      return { data: created }
    },
  },
  {
    method: 'GET',
    path: '/blacklist',
    resolve: ({ search }): ApiEnvelope<BlacklistEntryApi[]> => {
      const onlyActive = search.get('onlyActive') === 'true'
      return { data: entries.filter((entry) => !onlyActive || entry.isActive) }
    },
  },
  {
    method: 'POST',
    path: '/workers/:workerId/blacklist/lift',
    resolve: ({ params, body }): ApiEnvelope<BlacklistEntryApi> => {
      const liftReason = ((body ?? {}) as { liftReason?: string }).liftReason
      if (!liftReason) throw new Error('El motivo del levantamiento es obligatorio')
      const entry = entries.find((item) => item.worker.id === params.workerId && item.isActive)
      if (!entry) throw new Error('BLACKLIST_NOT_ACTIVE')
      entry.isActive = false
      entry.liftedAt = new Date().toISOString().slice(0, 10)
      entry.liftedBy = { id: 'usr-admin', fullName: 'Administrador' }
      entry.liftReason = liftReason
      return { data: entry }
    },
  },
]

let areRoutesRegistered = false

export function registerBlacklistMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  // Los nombres y estados de los workers viven en los mocks del Pool.
  registerPoolMocks()
}
