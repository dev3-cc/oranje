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

    /**
     * ÚNICO endpoint que NO desenvuelve el sobre a propósito: su `meta`
     * (`hasTaxId`, `taxRetentionApplies`) es dato real que la vista lee.
     * `WorkerDocumentListApi` ES el sobre — no lo cambies a `WorkerDocumentApi[]`
     * sin aplanar aquí, o la vista lee `undefined` (el bug que tuvo Propuestas).
     */
    getWorkerDocuments: build.query<WorkerDocumentListApi, string>({
      query: (workerId) => `/workers/${workerId}/documents`,
      providesTags: (_res, _err, workerId) => [
        { type: 'Worker' as const, id: `${workerId}-documents` },
      ],
    }),

    /** La ruta viene de `POST /files` (WORKER_DOCUMENT): el back valida el prefijo. */
    createWorkerDocument: build.mutation<
      void,
      { workerId: string; documentType: string; filePath: string }
    >({
      query: ({ workerId, ...body }) => ({
        url: `/workers/${workerId}/documents`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { workerId }) => [
        { type: 'Worker' as const, id: `${workerId}-documents` },
      ],
    }),

    /**
     * VERIFICAR es lo que levanta la retención del 16% cuando el documento es
     * el SSN/ITIN (D-33): cargar corre el plazo, verificar libera. Es permiso
     * de validación (`recruitment:validate_signup`), no de captura.
     */
    verifyWorkerDocument: build.mutation<void, { workerId: string; documentId: string }>({
      query: ({ workerId, documentId }) => ({
        url: `/workers/${workerId}/documents/${documentId}/verify`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, { workerId }) => [
        { type: 'Worker' as const, id: `${workerId}-documents` },
      ],
    }),

    deleteWorkerDocument: build.mutation<void, { workerId: string; documentId: string }>({
      query: ({ workerId, documentId }) => ({
        url: `/workers/${workerId}/documents/${documentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, { workerId }) => [
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
  useCreateWorkerDocumentMutation,
  useVerifyWorkerDocumentMutation,
  useDeleteWorkerDocumentMutation,
} = workerDetailApi
