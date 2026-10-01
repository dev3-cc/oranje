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
    actor: raw.actor,
    createdAt: raw.createdAt,
    readAt: raw.readAt,
  }
}

export const workerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Se refresca solo, y es la única consulta de la app que lo hace.
     *
     * Lo que esta ficha trae no lo cambia el Colaborador: a su documento lo
     * rechaza Reclutamiento, su semáforo lo mueve el sistema, su acceso lo
     * bloquea un plazo que vence. Todo eso pasa en OTRO navegador, así que
     * nada invalida la caché de este y el aviso aparecía recién al recargar
     * a mano (reportado por Hugo el 2026-10-01: «no lo muestra
     * inmediatamente, tienes que presionar cargar»).
     *
     * Por eso vuelve a pedirse al traer la app al frente —el caso del
     * teléfono que estuvo en el bolsillo—, al recuperar la red, y al entrar
     * a una pantalla si el dato ya tiene más de 30 segundos. Los 30 segundos
     * son para que moverse entre las cuatro pestañas no dispare una consulta
     * por toque.
     *
     * Las banderas son del hook, no del endpoint, así que viven en
     * `REFRESCO_DEL_PERFIL` y se aplican donde se consulta. NO se ponen en
     * `baseApi`: a lo ancho de la app harían que la cinta del Timesheet
     * —que carga todas las semanas de una vez— se rearmara cada vez que
     * alguien cambia de ventana.
     */
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
     * Sustituye la contraseña temporal que me dieron en mano por la mía
     * (Reglas de Negocio § Acceso del Colaborador). Levanta el plazo de 30
     * días al instante: el perfil se vuelve a pedir.
     */
    changeMyPassword: build.mutation<unknown, { newPassword: string }>({
      query: (body) => ({ url: '/workers/me/password', method: 'POST', body }),
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

/**
 * Cómo se refresca la ficha del Colaborador. Se declara una vez para que las
 * cinco pantallas que la consultan no se desincronicen entre ellas.
 *
 * `refetchOnFocus` es el que resuelve el reporte: basta con que lo tenga el
 * shell, que está montado siempre, para que la app entera reciba la ficha
 * fresca al volver al frente.
 */
export const REFRESCO_DEL_PERFIL = {
  refetchOnFocus: true,
  refetchOnReconnect: true,
  /** En segundos: entrar a una pantalla no vuelve a pedir si ya es reciente. */
  refetchOnMountOrArgChange: 30,
} as const

export const { useSetAvailableMutation } = availabilityApi

export const {
  useGetMyProfileQuery,
  useGetMyHistoryQuery,
  useCompleteSignupMutation,
  useChangeMyPasswordMutation,
  useUploadMyDocumentMutation,
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,
} = workerApi
