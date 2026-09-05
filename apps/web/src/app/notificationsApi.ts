/*
 * ⚠ Import entre features, permitido SOLO aquí: los fixtures de avisos viven
 * con el Colaborador y la campana del header los reutiliza. Con mocks
 * apagados es un no-op.
 */

import { baseApi } from '@/app/baseApi'
// eslint-disable-next-line no-restricted-imports
import { registerWorkerMocks } from '@/features/worker/api/workerMocks'

registerWorkerMocks()

/** Un aviso como lo sirve `GET /notifications` (permiso universal). */
interface NotificationApi {
  id: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
}

interface NotificationBoardApi {
  data: NotificationApi[]
  meta: { unread: number }
}

export interface HeaderNotification {
  id: string
  title: string
  body: string
  createdAt: string
  isRead: boolean
}

export interface HeaderNotifications {
  items: HeaderNotification[]
  /** El contador REAL del back (`meta.unread`), no un número pintado. */
  unread: number
}

/**
 * La campana del header. `system:receive_notification` lo tienen todos los
 * roles, así que la lista y el contador son reales para cualquiera; el «3»
 * hardcodeado que había antes era decoración (auditoría del 2026-09-04).
 */
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getHeaderNotifications: build.query<HeaderNotifications, void>({
      query: () => ({ url: '/notifications', params: { limit: 8 } }),
      transformResponse: (raw: NotificationBoardApi): HeaderNotifications => ({
        items: raw.data.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          isRead: item.readAt !== null,
        })),
        unread: raw.meta.unread,
      }),
      providesTags: [{ type: 'Worker' as const, id: 'NOTIFICATIONS' }],
    }),
    markHeaderNotificationRead: build.mutation<unknown, string>({
      query: (notificationId) => ({
        url: `/notifications/${notificationId}/read`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'NOTIFICATIONS' }],
    }),
  }),
})

export const { useGetHeaderNotificationsQuery, useMarkHeaderNotificationReadMutation } =
  notificationsApi
