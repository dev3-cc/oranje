import type { DepartmentMetric, Punch, StatusLightSummary } from '../types/observability.types'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, PaginatedEnvelope } from '@/shared/types/apiContract.types'

/**
 * Observador (`ROL-OBS-01`, Roles del Sistema.md 2026-09-21): transversal, de
 * solo lectura. Contrato de `apps/api/src/modules/observability/`, verificado
 * leyendo el controller y el service reales — 259/259 pruebas del back en
 * verde, incluida `observability.spec.ts`.
 *
 * Sin `providesTags`/`invalidatesTags`: los tres GET son de solo lectura y
 * ninguna mutación de la app escribe sobre lo que muestran — no hay nada que
 * invalidar (D-12, `baseApi` §tagTypes: un tag es para una entidad que SE
 * ESCRIBE en otra pantalla).
 */
export const observabilityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStatusDurations: build.query<StatusLightSummary[], void>({
      query: () => '/observability/status-durations',
      transformResponse: (raw: ApiEnvelope<StatusLightSummary[]>) => raw.data,
    }),

    getPunches: build.query<
      PaginatedEnvelope<Punch>,
      { page: number; limit: number; hotelId?: string }
    >({
      query: (params) => ({ url: '/observability/punches', params }),
      transformResponse: (raw: PaginatedEnvelope<Punch>) => raw,
    }),

    getDepartmentMetrics: build.query<DepartmentMetric[], void>({
      query: () => '/observability/department-metrics',
      transformResponse: (raw: ApiEnvelope<DepartmentMetric[]>) => raw.data,
    }),
  }),
})

export const { useGetStatusDurationsQuery, useGetPunchesQuery, useGetDepartmentMetricsQuery } =
  observabilityApi
