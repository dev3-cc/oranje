import { registerPoolMocks } from './poolMocks'

import { baseApi } from '@/app/baseApi'
import type {
  ApiEnvelope,
  WorkerApi,
  WorkerDocumentListApi,
  WorkerHistoryEntryApi,
  WorkerTransitionApi,
} from '@/shared/types/apiContract.types'

/**
 * El Expediente de la Reclutadora, sobre el contrato REAL de `/workers/:id`:
 * la ficha, su historia de semáforo (`worker_state_history`), las transiciones
 * que MI rol puede disparar y los documentos (`worker_document`).
 */
registerPoolMocks()

export const workerDetailApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWorkerDetail: build.query<WorkerApi, string>({
      query: (workerId) => `/workers/${workerId}`,
      transformResponse: (raw: ApiEnvelope<WorkerApi>) => raw.data,
      providesTags: (_res, _err, workerId) => [{ type: 'Worker' as const, id: workerId }],
    }),

    getWorkerHistory: build.query<WorkerHistoryEntryApi[], string>({
      query: (workerId) => `/workers/${workerId}/history`,
      transformResponse: (raw: ApiEnvelope<WorkerHistoryEntryApi[]>) => raw.data,
      providesTags: (_res, _err, workerId) => [
        { type: 'Worker' as const, id: `${workerId}-history` },
      ],
    }),

    /** Ya vienen filtradas por mi rol: una lista vacía es la respuesta honesta. */
    getWorkerTransitions: build.query<WorkerTransitionApi[], string>({
      query: (workerId) => `/workers/${workerId}/transitions`,
      transformResponse: (raw: ApiEnvelope<WorkerTransitionApi[]>) => raw.data,
      providesTags: (_res, _err, workerId) => [
        { type: 'Worker' as const, id: `${workerId}-transitions` },
      ],
    }),

    changeWorkerState: build.mutation<
      unknown,
      { workerId: string; toState: string; note?: string }
    >({
      query: ({ workerId, ...body }) => ({
        url: `/workers/${workerId}/transitions`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { workerId }) => [
        { type: 'Worker' as const, id: workerId },
        { type: 'Worker' as const, id: `${workerId}-history` },
        { type: 'Worker' as const, id: `${workerId}-transitions` },
        { type: 'Worker' as const, id: 'LIST' },
      ],
    }),

    getWorkerDocuments: build.query<WorkerDocumentListApi, string>({
      query: (workerId) => `/workers/${workerId}/documents`,
      providesTags: (_res, _err, workerId) => [
        { type: 'Worker' as const, id: `${workerId}-documents` },
      ],
    }),
  }),
})

export const {
  useGetWorkerDetailQuery,
  useGetWorkerHistoryQuery,
  useGetWorkerTransitionsQuery,
  useChangeWorkerStateMutation,
  useGetWorkerDocumentsQuery,
} = workerDetailApi
