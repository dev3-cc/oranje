import { registerMessagingWorkersSyncMocks } from './messagingWorkersSyncMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerMessagingWorkersSyncMocks()

export interface WorkersMessagingSyncResult {
  sent: number
  created: number
  updated: number
  /** Los que la plataforma descartó aun así. */
  rejected: number
  withoutPhone: number
  invalidPhone: number
  /** Entraron a la lista negra: quedan inactivos, fuera de toda campaña. */
  deactivated: number
  /** Salieron de la lista negra: vuelven a recibir. */
  reactivated: number
  /** Cambiaron de hotel o de estado: se les cambiaron las etiquetas. */
  retagged: number
}

/** Un colaborador que no llega a la plataforma, y por qué. */
export interface ExcludedWorker {
  id: string
  fullName: string
  /** Tal como está guardado; vacío si no tiene. */
  phone: string
  reason: 'NO_PHONE' | 'INVALID_PHONE'
}

export type WorkersMessagingSyncStatus =
  | { configured: false }
  | {
      configured: true
      workers: number
      synced: number
      pending: number
      excluded: ExcludedWorker[]
    }

export const messagingWorkersSyncApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWorkersSyncStatus: build.query<WorkersMessagingSyncStatus, void>({
      query: () => '/workers/messaging-sync/status',
      transformResponse: (raw: ApiEnvelope<WorkersMessagingSyncStatus>) => raw.data,
      providesTags: ['Messaging'],
    }),
    /* Invalida Mensajería: cambian los contactos, las etiquetas y el estado. */
    syncWorkersToMessaging: build.mutation<WorkersMessagingSyncResult, void>({
      query: () => ({ url: '/workers/messaging-sync', method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<WorkersMessagingSyncResult>) => raw.data,
      invalidatesTags: ['Messaging'],
    }),
  }),
})

export const { useGetWorkersSyncStatusQuery, useSyncWorkersToMessagingMutation } =
  messagingWorkersSyncApi
