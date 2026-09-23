import {
  ANY_VALUE,
  type CreateWorkerRequest,
  type WorkerAccessCredential,
  type PoolFilters,
  type PoolOptions,
  type PoolWorker,
  type WorkerPool,
} from '../types/pool.types'

import { registerPoolMocks } from './poolMocks'

import { baseApi } from '@/app/baseApi'
import type { WorkerStatus } from '@/shared/constants/workerStatus'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type { ApiEnvelope, CatalogItemApi, WorkerApi } from '@/shared/types/apiContract.types'

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
    profileDueAt: worker.profileDueAt,
    hasAccount: worker.hasAccount,
    hasTaxId: worker.hasTaxId,
    createdAt: worker.createdAt,
    isBlacklisted: worker.isBlacklisted,
    assignment: worker.assignment,
  }
}

async function fetchPool(
  fetchWithBQ: FetchWithBQ,
  filters: PoolFilters,
): Promise<{ data: WorkerPool } | { error: unknown }> {
  const search = filters.search.trim()
  /* La lista no pagina: con 300 colaboradores y una sola página de 100, el
     encabezado decía «303 en el pool» y la lista enseñaba a 100. */
  const listRes = await fetchAllPages<WorkerApi>(fetchWithBQ, '/workers', {
    /** El back busca por nombre con `?search=`; vacío no viaja. */
    ...(search !== '' ? { search } : {}),
    ...(filters.status !== ANY_VALUE ? { state: filters.status } : {}),
    ...(filters.zoneId !== ANY_VALUE ? { zoneId: filters.zoneId } : {}),
    ...(filters.catalogPositionId !== ANY_VALUE
      ? { catalogPositionId: filters.catalogPositionId }
      : {}),
    ...(filters.englishLevelId !== ANY_VALUE ? { englishLevelId: filters.englishLevelId } : {}),
  })
  if ('error' in listRes) return { error: listRes.error }

  const workers = listRes.data.filter(
    (worker) =>
      filters.hiringModalityId === ANY_VALUE ||
      worker.hiringModality?.id === filters.hiringModalityId,
  )

  return {
    data: {
      items: workers.map(toPoolWorker),
      total: workers.length,
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

    createWorker: build.mutation<WorkerApi, CreateWorkerRequest>({
      query: (body) => ({ url: '/workers', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<WorkerApi>) => response.data,
      invalidatesTags: [{ type: 'Worker' as const, id: 'LIST' }],
    }),

    /**
     * El acceso del colaborador: cuenta de Oranje + buzón corporativo con UNA
     * contraseña temporal que se muestra una sola vez y se entrega en mano.
     * El dominio lo pone el API; el front solo manda la parte local.
     */
    createWorkerAccess: build.mutation<
      WorkerAccessCredential,
      { workerId: string; localPart: string }
    >({
      query: ({ workerId, localPart }) => ({
        url: `/workers/${workerId}/access`,
        method: 'POST',
        body: { localPart },
      }),
      transformResponse: (response: ApiEnvelope<WorkerAccessCredential>) => response.data,
      invalidatesTags: (_res, _err, { workerId }) => [
        { type: 'Worker' as const, id: 'LIST' },
        { type: 'Worker' as const, id: workerId },
      ],
    }),

    getAccessDomain: build.query<string, void>({
      query: () => '/workers/access-domain',
      transformResponse: (response: ApiEnvelope<{ domain: string }>) => response.data.domain,
    }),

    /**
     * Nunca se borra la fila (queda `deleted_at`), y de paso borra su correo
     * corporativo en cPanel si tenía (Hugo, 2026-09-15). Si sigue trabajando,
     * el back libera cada asignación activa suya antes de eliminarlo — no
     * bloquea.
     */
    deleteWorker: build.mutation<unknown, string>({
      query: (workerId) => ({ url: `/workers/${workerId}`, method: 'DELETE' }),
      invalidatesTags: (_res, _err, workerId) => [
        { type: 'Worker' as const, id: 'LIST' },
        { type: 'Worker' as const, id: workerId },
      ],
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
  useDeleteWorkerMutation,
  useCreateWorkerAccessMutation,
  useGetAccessDomainQuery,
} = poolApi
