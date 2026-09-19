import { baseApi } from './baseApi'

import { registerMockRoutes } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/**
 * `POST /files`: la subida de archivos al bucket (módulo `files` del backend).
 * Lo que se GUARDA en las entidades es el `path`; la `url` firmada es solo
 * para previsualizar. Vive en `app/` porque lo consumen varias features
 * (foto del colaborador, documentos, ponche).
 */

export const FILE_PURPOSES = [
  'WORKER_PHOTO',
  'WORKER_DOCUMENT',
  'PUNCH_PHOTO',
  'USER_PHOTO',
] as const

export type FilePurpose = (typeof FILE_PURPOSES)[number]

export interface UploadedFileApi {
  path: string
  /** URL firmada para previsualizar; lo persistible es `path`. */
  url: string | null
  contentType: string
  bytes: number
  originalBytes: number
}

let mockFileSequence = 0

registerMockRoutes([
  {
    method: 'POST',
    path: '/files',
    /** El mock no guarda bytes: devuelve la forma real con un path plausible. */
    resolve: ({ body }): ApiEnvelope<UploadedFileApi> => {
      mockFileSequence += 1
      const raw = body instanceof FormData ? body.get('purpose') : null
      const purpose = typeof raw === 'string' ? raw : ''
      const folder =
        purpose === 'PUNCH_PHOTO'
          ? 'operations/punch'
          : purpose === 'WORKER_DOCUMENT'
            ? 'workers/document'
            : purpose === 'USER_PHOTO'
              ? 'users/photo'
              : 'workers/photo'
      return {
        data: {
          path: `${folder}/mock-${String(mockFileSequence).padStart(3, '0')}.jpg`,
          url: null,
          contentType: 'image/jpeg',
          bytes: 120_000,
          originalBytes: 480_000,
        },
      }
    },
  },
])

export const filesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    uploadFile: build.mutation<UploadedFileApi, { file: File; purpose: FilePurpose }>({
      query: ({ file, purpose }) => {
        const body = new FormData()
        body.append('file', file)
        body.append('purpose', purpose)
        return { url: '/files', method: 'POST', body }
      },
      transformResponse: (raw: ApiEnvelope<UploadedFileApi>) => raw.data,
    }),
  }),
})

export const { useUploadFileMutation } = filesApi
