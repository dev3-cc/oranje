import type { PoolFilters, WorkerPool } from '../types/pool.types'

import { registerPoolMocks } from './poolMocks'

import { baseApi } from '@/app/baseApi'

registerPoolMocks()

/**
 * Pool de Colaboradores sobre el `createApi` único (D-12), con el tag `Worker`.
 *
 * El filtrado va al servidor: el pool son cientos de personas y la tabla es una
 * página, así que filtrar lo descargado escondería a quien sí cumple.
 */
export const poolApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWorkerPool: build.query<WorkerPool, PoolFilters>({
      query: ({ catalogPosition, zoneName, englishLevel, hiringModality, status }) => ({
        url: '/pool',
        params: {
          position: catalogPosition,
          zone: zoneName,
          english: englishLevel,
          modality: hiringModality,
          status,
        },
      }),
      providesTags: (pool) => [
        { type: 'Worker' as const, id: 'LIST' },
        ...(pool?.items ?? []).map((item) => ({ type: 'Worker' as const, id: item.id })),
      ],
    }),
  }),
})

export const { useGetWorkerPoolQuery } = poolApi
