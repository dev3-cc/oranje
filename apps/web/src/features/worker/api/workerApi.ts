import type {
  CompleteSignupRequest,
  MyNotificationList,
  MyProfile,
  NotificationApi,
  NotificationBoardApi,
} from '../types/worker.types'

import { registerWorkerMocks } from './workerMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/**
 * El contrato PROPIO del Colaborador (todo `_own`, el alcance sale del token):
 * `GET /workers/me` (mi expediente + el plazo de SSN/ITIN), `PATCH
 * /workers/me/signup` (fases 2 y 3) y mis notificaciones.
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

export const {
  useGetMyProfileQuery,
  useCompleteSignupMutation,
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,
} = workerApi
