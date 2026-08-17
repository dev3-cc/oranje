import type {
  AuthorizationQueue,
  AuthorizationRequest,
  ResolveAuthorizationPayload,
  StatusChangeReason,
} from '../types/requisition.types'

import { registerAuthorizationsMocks } from './authorizationsMocks'

import { baseApi } from '@/app/baseApi'

registerAuthorizationsMocks()

/**
 * Cola de autorización, sobre el mismo `createApi` (D-12).
 *
 * Firmar invalida `Requisition/LIST` además de la cola: la métrica «Por
 * autorizar» del tablero y el semáforo de esa requisición cambian con la firma,
 * y es justo esto lo que se perdería con un `createApi` por feature.
 */
export const authorizationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAuthorizationQueue: build.query<AuthorizationQueue, void>({
      query: () => '/requisitions/authorizations',
      providesTags: (queue) => [
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
        ...(queue?.items ?? []).map((item) => ({ type: 'Requisition' as const, id: item.id })),
      ],
    }),

    /**
     * El motivo sale de `catalogs.status_change_reason` y por eso se pide al
     * backend: se administra sin desplegar front, al revés que el tipo de
     * intento de contacto, que es lista cerrada en código.
     */
    getStatusChangeReasons: build.query<{ items: StatusChangeReason[] }, void>({
      query: () => '/catalogs/status-change-reasons',
      providesTags: [{ type: 'Catalog' as const, id: 'STATUS_CHANGE_REASON' }],
    }),

    authorizeRequisition: build.mutation<AuthorizationRequest, ResolveAuthorizationPayload>({
      query: ({ requisitionId, reasonId }) => ({
        url: `/requisitions/${requisitionId}/authorize`,
        method: 'POST',
        body: { reasonId },
      }),
      invalidatesTags: (_result, _error, { requisitionId }) => [
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),

    rejectRequisition: build.mutation<AuthorizationRequest, ResolveAuthorizationPayload>({
      query: ({ requisitionId, reasonId }) => ({
        url: `/requisitions/${requisitionId}/reject`,
        method: 'POST',
        body: { reasonId },
      }),
      invalidatesTags: (_result, _error, { requisitionId }) => [
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),
  }),
})

export const {
  useGetAuthorizationQueueQuery,
  useGetStatusChangeReasonsQuery,
  useAuthorizeRequisitionMutation,
  useRejectRequisitionMutation,
} = authorizationsApi
