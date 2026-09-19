import type {
  AdminChecklistItem,
  Audit,
  AuditHeader,
  AuditResponseInput,
  AuditType,
  ChecklistItem,
  LastAuditPerWorker,
} from '../types/audit.types'

import { registerAuditsMocks } from './auditsMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, PaginatedEnvelope } from '@/shared/types/apiContract.types'

/**
 * Auditoría de Presentación y Ambiente (`supervision.audit`), ya construida y
 * probada en el back — 183/183 tests verdes en
 * `apps/api/src/modules/supervision/audits/`. Contrato verificado leyendo el
 * controller, el service y los DTOs reales, no transcrito de memoria.
 */
registerAuditsMocks()

export const auditsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * El nombre y la foto del hotel, para el hero de la tarjeta (mismo
     * contrato que `personnelApi.getHotelCard`; propio aquí para no acoplar
     * dos features por un GET de una línea).
     */
    getAuditsHotel: build.query<{ name: string; photoUrl: string | null }, string>({
      query: (hotelId) => `/hotels/${hotelId}`,
      transformResponse: (raw: ApiEnvelope<{ name: string; photoUrl: string | null }>) => raw.data,
      providesTags: (_res, _err, hotelId) => [{ type: 'Hotel' as const, id: hotelId }],
    }),

    /** Los reactivos vigentes de UNA auditoría, agrupados por categoría y ordinal (lectura abierta). */
    getChecklistItems: build.query<ChecklistItem[], AuditType | void>({
      query: (auditType) => ({
        url: '/catalogs/audit-checklist-items',
        params: auditType ? { auditType } : {},
      }),
      transformResponse: (raw: ApiEnvelope<ChecklistItem[]>) => raw.data,
      providesTags: (result) => [
        { type: 'ChecklistItem' as const, id: 'LIST' },
        ...(result ?? []).map((item) => ({ type: 'ChecklistItem' as const, id: item.id })),
      ],
    }),

    /** Solo el Administrador (`catalogs:manage`): alta de un reactivo. */
    createChecklistItem: build.mutation<
      AdminChecklistItem,
      { auditType: AuditType; category: string; label: string; weight?: number; ordinal: number }
    >({
      query: (body) => ({ url: '/catalogs/audit-checklist-items', method: 'POST', body }),
      transformResponse: (raw: ApiEnvelope<AdminChecklistItem>) => raw.data,
      invalidatesTags: [{ type: 'ChecklistItem' as const, id: 'LIST' }],
    }),

    /** `auditType` no se corrige (rompería las respuestas ya guardadas). */
    updateChecklistItem: build.mutation<
      AdminChecklistItem,
      { id: string; category?: string; label?: string; weight?: number; ordinal?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/catalogs/audit-checklist-items/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: ApiEnvelope<AdminChecklistItem>) => raw.data,
      invalidatesTags: [{ type: 'ChecklistItem' as const, id: 'LIST' }],
    }),

    deleteChecklistItem: build.mutation<unknown, string>({
      query: (id) => ({ url: `/catalogs/audit-checklist-items/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'ChecklistItem' as const, id: 'LIST' }],
    }),

    /** El tablero: auditorías del hotel (o de un colaborador/tipo), más recientes primero. */
    getAudits: build.query<
      AuditHeader[],
      { hotelId?: string; workerId?: string; auditType?: AuditType }
    >({
      query: (params) => ({ url: '/audits', params }),
      transformResponse: (raw: PaginatedEnvelope<AuditHeader>) => raw.data,
      providesTags: (result) => [
        { type: 'Audit' as const, id: 'LIST' },
        ...(result ?? []).map((item) => ({ type: 'Audit' as const, id: item.id })),
      ],
    }),

    getAudit: build.query<Audit, string>({
      query: (id) => `/audits/${id}`,
      transformResponse: (raw: ApiEnvelope<Audit>) => raw.data,
      providesTags: (_res, _err, id) => [{ type: 'Audit' as const, id }],
    }),

    /** "Tiempo sin auditar": el roster del hotel con su última PERSONAL_PRESENTATION (o `null`). */
    getLastAuditPerWorker: build.query<LastAuditPerWorker[], string>({
      query: (hotelId) => ({ url: '/audits/last-per-worker', params: { hotelId } }),
      transformResponse: (raw: ApiEnvelope<LastAuditPerWorker[]>) => raw.data,
      providesTags: [{ type: 'Audit' as const, id: 'LIST' }],
    }),

    createAudit: build.mutation<
      Audit,
      {
        auditType: AuditType
        hotelId: string
        workerId?: string
        observations?: string
        responses: AuditResponseInput[]
      }
    >({
      query: (body) => ({ url: '/audits', method: 'POST', body }),
      transformResponse: (raw: ApiEnvelope<Audit>) => raw.data,
      invalidatesTags: [{ type: 'Audit' as const, id: 'LIST' }],
    }),

    /** Corregir: solo lo que cambia — la pantalla siempre manda el estado completo, el back solo escribe lo distinto. */
    updateAudit: build.mutation<
      Audit,
      { id: string; observations?: string; responses?: AuditResponseInput[] }
    >({
      query: ({ id, ...body }) => ({ url: `/audits/${id}`, method: 'PATCH', body }),
      transformResponse: (raw: ApiEnvelope<Audit>) => raw.data,
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Audit' as const, id },
        { type: 'Audit' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetAuditsHotelQuery,
  useGetChecklistItemsQuery,
  useCreateChecklistItemMutation,
  useUpdateChecklistItemMutation,
  useDeleteChecklistItemMutation,
  useGetAuditsQuery,
  useGetAuditQuery,
  useGetLastAuditPerWorkerQuery,
  useCreateAuditMutation,
  useUpdateAuditMutation,
} = auditsApi
