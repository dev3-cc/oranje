import {
  ANY_VALUE,
  type CreateWorkerRequest,
  type PoolFilters,
  type PoolOptions,
  type PoolWorker,
  type WorkerPool,
} from '../types/pool.types'

import { registerPoolMocks } from './poolMocks'

import { baseApi } from '@/app/baseApi'
import type { WorkerStatus } from '@/shared/constants/workerStatus'
import type {
  ApiEnvelope,
  CatalogItemApi,
  PaginatedEnvelope,
  WorkerApi,
} from '@/shared/types/apiContract.types'

registerPoolMocks()

type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

function toPoolWorker(worker: WorkerApi): PoolWorker {
  return {
    id: worker.id,
    fullName: worker.fullName,
    photoUrl: worker.photoUrl,
    age: worker.age,
    zoneName: worker.zone.name.replace(/^Zona\s+/i, ''),
    catalogPosition: worker.position?.name ?? '—',
    englishLevel: worker.englishLevel?.name ?? '—',
    hiringModality: worker.hiringModality?.name ?? '—',
    status: worker.state.code as WorkerStatus,
    isProfileComplete: worker.isProfileComplete,
    hasTaxId: worker.hasTaxId,
    createdAt: worker.createdAt,
    isBlacklisted: worker.isBlacklisted,
  }
}

async function fetchPool(
  fetchWithBQ: FetchWithBQ,
  filters: PoolFilters,
): Promise<{ data: WorkerPool } | { error: unknown }> {
  const listRes = await fetchWithBQ({
    url: '/workers',
    params: {
      limit: 100,
      ...(filters.status !== ANY_VALUE ? { state: filters.status } : {}),
      ...(filters.zoneId !== ANY_VALUE ? { zoneId: filters.zoneId } : {}),
      ...(filters.catalogPositionId !== ANY_VALUE
        ? { catalogPositionId: filters.catalogPositionId }
        : {}),
      ...(filters.englishLevelId !== ANY_VALUE ? { englishLevelId: filters.englishLevelId } : {}),
    },
  })
  if (listRes.error) return { error: listRes.error }

  const board = listRes.data as PaginatedEnvelope<WorkerApi>
  const workers = board.data.filter(
    (worker) =>
      filters.hiringModalityId === ANY_VALUE ||
      worker.hiringModality?.id === filters.hiringModalityId,
  )

  return {
    data: {
      items: workers.map(toPoolWorker),
      total: filters.hiringModalityId === ANY_VALUE ? board.meta.total : workers.length,
    },
  }
}

async function fetchOptions(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: PoolOptions } | { error: unknown }> {
  const [positionsRes, zonesRes, englishRes, modalitiesRes] = await Promise.all([
    fetchWithBQ('/catalogs/positions'),
    fetchWithBQ('/catalogs/zones'),
    fetchWithBQ('/catalogs/english-levels'),
    fetchWithBQ('/catalogs/hiring-modalities'),
  ])
  for (const res of [positionsRes, zonesRes, englishRes, modalitiesRes]) {
    if (res.error) return { error: res.error }
  }
  const items = (res: { data?: unknown }): Array<{ id: string; name: string }> =>
    (res.data as ApiEnvelope<CatalogItemApi[]>).data.map((item) => ({
      id: item.id,
      name: item.name,
    }))

  return {
    data: {
      positions: items(positionsRes),
      zones: items(zonesRes),
      englishLevels: items(englishRes),
      modalities: items(modalitiesRes),
    },
  }
}

export const poolApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWorkerPool: build.query<WorkerPool, PoolFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchPool(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (pool) => [
        { type: 'Worker' as const, id: 'LIST' },
        ...(pool?.items ?? []).map((item) => ({ type: 'Worker' as const, id: item.id })),
      ],
    }),

    updateWorker: build.mutation<unknown, { workerId: string } & Partial<CreateWorkerRequest>>({
      query: ({ workerId, ...body }) => ({
        url: `/workers/${workerId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_res, _err, { workerId }) => [
        { type: 'Worker' as const, id: 'LIST' },
        { type: 'Worker' as const, id: workerId },
      ],
    }),

    createWorker: build.mutation<unknown, CreateWorkerRequest>({
      query: (body) => ({ url: '/workers', method: 'POST', body }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'LIST' }],
    }),

    getPoolOptions: build.query<PoolOptions, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchOptions(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'POOL_FILTERS' }],
    }),
  }),
})

export const {
  useGetWorkerPoolQuery,
  useGetPoolOptionsQuery,
  useCreateWorkerMutation,
  useUpdateWorkerMutation,
} = poolApi
