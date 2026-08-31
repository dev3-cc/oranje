import type {
  CompleteSignupRequest,
  MyNotificationList,
  MyProfile,
  NotificationApi,
  NotificationBoardApi,
} from '../types/worker.types'

import { registerWorkerMocks } from './workerMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, WorkerHistoryEntryApi } from '@/shared/types/apiContract.types'

/**
 * El contrato PROPIO del Colaborador (todo `_own`, el alcance sale del token):
 * `GET /workers/me` (mi expediente + el plazo de SSN/ITIN), `GET
 * /workers/me/history` (mi semáforo), `PATCH /workers/me/signup` (fases 2 y
 * 3) y mis notificaciones.
 */
registerWorkerMocks()

function toMyNotification(raw: NotificationApi): MyNotificationList['items'][number] {
  return {
    id: raw.id,
    typeCode: raw.type.code,
    title: raw.title,
    body: raw.body,
    entityType: raw.entity?.type ?? null,
    entityId: raw.entity?.id ?? null,
    createdAt: raw.createdAt,
    readAt: raw.readAt,
  }
}

export const workerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyProfile: build.query<MyProfile, void>({
      query: () => '/workers/me',
      transformResponse: (raw: ApiEnvelope<MyProfile>) => raw.data,
      providesTags: [{ type: 'Worker' as const, id: 'ME' }],
    }),

    /**
     * Mi recorrido por el semáforo, la misma forma que `/workers/:id/history`
     * y del más reciente al más viejo. Sin filas es `[]`, no 404. Comparte
     * la etiqueta ME: encender disponibilidad lo refresca.
     */
    getMyHistory: build.query<WorkerHistoryEntryApi[], void>({
      query: () => '/workers/me/history',
      transformResponse: (raw: ApiEnvelope<WorkerHistoryEntryApi[]>) => raw.data,
      providesTags: [{ type: 'Worker' as const, id: 'ME' }],
    }),

    /**
     * Mi SSN/ITIN (RF-C-01): la persona lo sube ella misma. La ruta sale de
     * `POST /files` (WORKER_DOCUMENT) y el back valida el prefijo; el
     * documento nace sin verificar — verificar sigue siendo de la Reclutadora.
     */
    uploadMyDocument: build.mutation<unknown, { documentType: 'SSN_ITIN'; filePath: string }>({
      query: (body) => ({ url: '/workers/me/documents', method: 'POST', body }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'ME' }],
    }),

    /** Fases 2 y 3 (RF-C-01/02): campos opcionales, al menos uno por envío. */
    completeSignup: build.mutation<unknown, CompleteSignupRequest>({
      query: (body) => ({ url: '/workers/me/signup', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'ME' }],
    }),

    /**
     * Mis avisos (RF-C-09): una fila por destinatario, no leída = `read_at`
     * nulo. El contrato real es un board paginado con `type`/`entity`
     * anidados; se aplana aquí, en la única frontera (D-28).
     */
    getMyNotifications: build.query<MyNotificationList, void>({
      query: () => ({ url: '/notifications', params: { limit: 50 } }),
      transformResponse: (raw: NotificationBoardApi) => ({
        items: raw.data.map(toMyNotification),
        unread: raw.meta.unread,
      }),
      providesTags: [{ type: 'Worker' as const, id: 'NOTIFICATIONS' }],
    }),

    markNotificationRead: build.mutation<unknown, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'NOTIFICATIONS' }],
    }),
  }),
})

export const availabilityApi = workerApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Amarillo = «disponible por voluntad propia». Autoservicio sin
     * aprobación; si el semáforo no lo permite desde el estado actual, el
     * back responde y se muestra en palabras. Volver a Verde fuerte NO es
     * una transición del semáforo: el Colaborador solo enciende.
     */
    setAvailable: build.mutation<MyProfile, void>({
      query: () => ({ url: '/workers/me/availability', method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<MyProfile>) => raw.data,
      invalidatesTags: [{ type: 'Worker' as const, id: 'ME' }],
    }),
  }),
})

export const { useSetAvailableMutation } = availabilityApi

export const {
  useGetMyProfileQuery,
  useGetMyHistoryQuery,
  useCompleteSignupMutation,
  useUploadMyDocumentMutation,
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,
} = workerApi
