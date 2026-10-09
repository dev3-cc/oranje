import type { CreatePayAdjustmentRequest, PayAdjustment } from '../types/selfPick.types'

import { registerPayAdjustmentsMocks } from './payAdjustmentsMocks'

import { baseApi } from '@/app/baseApi'
/*
 * ⚠ Import entre features, permitido SOLO para registrar mocks: el catálogo
 * de conceptos de pago (Uber…) lo registra Requisiciones. Apagados, es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import type { ApiEnvelope, CatalogItemApi } from '@/shared/types/apiContract.types'

/**
 * El ajuste de tarifa o el gasto extra (p. ej. «Uber») de una asignación
 * EVENTUAL (Hugo, 2026-10-08): Reclutamiento lo pide al llenar el slot, el
 * Observador lo aprueba o lo rechaza — única excepción a que ese rol es de
 * puro lectura. Mientras está PENDING no pesa en nada.
 */
registerRequisitionsMocks()
registerPayAdjustmentsMocks()

export const payAdjustmentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** El catálogo del Administrador (p. ej. «Uber»), para el gasto con concepto. */
    getPayConcepts: build.query<CatalogItemApi[], void>({
      query: () => '/catalogs/pay-concepts',
      transformResponse: (res: ApiEnvelope<CatalogItemApi[]>) => res.data,
      providesTags: [{ type: 'Catalog' as const, id: 'PAY_CONCEPTS' }],
    }),

    createPayAdjustment: build.mutation<PayAdjustment, CreatePayAdjustmentRequest>({
      query: ({ assignmentId, ...body }) => ({
        url: `/assignments/${assignmentId}/pay-adjustments`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: ApiEnvelope<PayAdjustment>) => res.data,
      invalidatesTags: [{ type: 'PayAdjustment' as const, id: 'PENDING' }],
    }),

    /** La cola del Observador: todo lo PENDING, de cualquier hotel. */
    getPendingPayAdjustments: build.query<PayAdjustment[], void>({
      query: () => '/pay-adjustments/pending',
      transformResponse: (res: ApiEnvelope<PayAdjustment[]>) => res.data,
      providesTags: [{ type: 'PayAdjustment' as const, id: 'PENDING' }],
    }),

    approvePayAdjustment: build.mutation<PayAdjustment, { id: string }>({
      query: ({ id }) => ({ url: `/pay-adjustments/${id}/approve`, method: 'POST' }),
      transformResponse: (res: ApiEnvelope<PayAdjustment>) => res.data,
      invalidatesTags: [{ type: 'PayAdjustment' as const, id: 'PENDING' }],
    }),

    rejectPayAdjustment: build.mutation<PayAdjustment, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/pay-adjustments/${id}/reject`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (res: ApiEnvelope<PayAdjustment>) => res.data,
      invalidatesTags: [{ type: 'PayAdjustment' as const, id: 'PENDING' }],
    }),
  }),
})

export const {
  useGetPayConceptsQuery,
  useCreatePayAdjustmentMutation,
  useGetPendingPayAdjustmentsQuery,
  useApprovePayAdjustmentMutation,
  useRejectPayAdjustmentMutation,
} = payAdjustmentsApi
