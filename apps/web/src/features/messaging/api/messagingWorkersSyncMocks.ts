import type {
  ExcludedWorker,
  WorkersMessagingSyncResult,
  WorkersMessagingSyncStatus,
} from './messagingWorkersSyncApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Los tres que el resultado de la sincronización cuenta como no enviados. */
const EXCLUDED: ExcludedWorker[] = [
  { id: 'wrk-0001', fullName: 'Ana Rivera Gómez', phone: '', reason: 'NO_PHONE' },
  { id: 'wrk-0002', fullName: 'Luis Cabrera', phone: '', reason: 'NO_PHONE' },
  { id: 'wrk-0003', fullName: 'María Fernanda Ortiz', phone: '555-12', reason: 'INVALID_PHONE' },
]

/** Faltan dos hasta que se sincroniza; después, ninguno. */
let pending = 2

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/workers/messaging-sync/status',
    resolve: (): ApiEnvelope<WorkersMessagingSyncStatus> => ({
      data: { configured: true, workers: 12, synced: 12 - pending, pending, excluded: EXCLUDED },
    }),
  },
  {
    method: 'POST',
    path: '/workers/messaging-sync',
    resolve: (): ApiEnvelope<WorkersMessagingSyncResult> => {
      pending = 0
      return {
        data: {
          sent: 12,
          created: 2,
          updated: 10,
          rejected: 0,
          withoutPhone: 2,
          invalidPhone: 1,
          deactivated: 1,
          reactivated: 0,
          retagged: 0,
        },
      }
    },
  },
]

export function registerMessagingWorkersSyncMocks(): void {
  registerMockRoutes(routes)
}
