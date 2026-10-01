/*
 * ⚠ Import entre features, permitido SOLO aquí: los fixtures de avisos viven
 * con el Colaborador y la campana del header los reutiliza. Con mocks
 * apagados es un no-op.
 */

import { baseApi } from '@/app/baseApi'
// eslint-disable-next-line no-restricted-imports
import { registerWorkerMocks } from '@/features/worker/api/workerMocks'
import { notificationTarget } from '@/shared/lib/notificationTarget'

registerWorkerMocks()

/** Un aviso como lo sirve `GET /notifications` (permiso universal). */
interface NotificationApi {
  id: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
  /** La entidad que provocó el aviso; es lo que permite llevar a la acción. */
  entity: { type: string; id: string } | null
  /** Quien lo disparó con su acción; null en avisos sin actor humano. */
  actor: { id: string; fullName: string; photoUrl: string | null } | null
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
  actor: { fullName: string; photoUrl: string | null } | null
  /**
   * A dónde lleva al tocarlo, ya resuelto a ruta; `null` cuando la entidad no
   * tiene pantalla conocida y el aviso solo se marca leído.
   */
  href: string | null
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
          actor: item.actor
            ? { fullName: item.actor.fullName, photoUrl: item.actor.photoUrl }
            : null,
          href: notificationTarget(item.entity ?? null),
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

/**
 * Cómo se mantiene viva la campana.
 *
 * Un aviso lo genera OTRA persona, en otro navegador, así que ninguna
 * invalidación de etiqueta puede llegar hasta aquí: sin esto el contador no
 * se movía en toda la sesión, y con él la lógica de «suena cuando el contador
 * sube» del Header no podía dispararse nunca (censo del 2026-10-01).
 *
 * Es la única consulta de la app que PREGUNTA cada tanto, y se justifica
 * porque es la única donde se espera que algo llegue sin hacer nada. Las
 * demás se refrescan al volver al frente, que basta cuando la persona sí
 * actúa.
 *
 * `skipPollingIfUnfocused` es la mitad que importa: un teléfono en el
 * bolsillo o una pestaña de fondo no preguntan nada. `refetchOnFocus` cubre
 * el regreso, para no esperar hasta el siguiente turno del sondeo.
 *
 * Lo correcto a futuro es el push: el API ya manda a FCM y el navegador
 * nunca se registra, así que su mitad está hecha. Mientras no exista, esto.
 */
export const CAMPANA_VIVA = {
  pollingInterval: 45_000,
  skipPollingIfUnfocused: true,
  refetchOnFocus: true,
  refetchOnReconnect: true,
} as const

export const { useGetHeaderNotificationsQuery, useMarkHeaderNotificationReadMutation } =
  notificationsApi
