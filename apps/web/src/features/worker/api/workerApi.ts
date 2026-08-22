import type {
  MyNotificationList,
  MyProfile,
  NotificationApi,
  NotificationBoardApi,
  UpdatePhase2Request,
  UpdatePhase3Request,
} from '../types/worker.types'

import { registerWorkerMocks } from './workerMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, CatalogItemApi } from '@/shared/types/apiContract.types'

/**
 * El contrato PROPIO del Colaborador: `GET/PATCH /workers/me` (mi expediente,
 * solo mi fila) y `GET /notifications` + marcar leída (solo las mías, por el
 * modelo de Notificaciones). La sesión de backend lo está construyendo con
 * estos nombres; mientras, los mocks responden esta misma forma.
 */
registerWorkerMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (args: string) => Promise<{ data?: unknown; error?: unknown }>

export interface WorkerCatalogs {
  positions: CatalogItemApi[]
  englishLevels: CatalogItemApi[]
  modalities: CatalogItemApi[]
}

/** Los 3 catálogos que la Fase 2 elige, compuestos en el front (D-28). */
async function fetchCatalogs(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: WorkerCatalogs } | { error: unknown }> {
  const [positionsRes, englishRes, modalitiesRes] = await Promise.all([
    fetchWithBQ('/catalogs/positions'),
    fetchWithBQ('/catalogs/english-levels'),
    fetchWithBQ('/catalogs/hiring-modalities'),
  ])
  for (const res of [positionsRes, englishRes, modalitiesRes]) {
    if (res.error) return { error: res.error }
  }
  const items = (res: { data?: unknown }): CatalogItemApi[] =>
    (res.data as ApiEnvelope<CatalogItemApi[]>).data

  return {
    data: {
      positions: items(positionsRes),
      englishLevels: items(englishRes),
      modalities: items(modalitiesRes),
    },
  }
}

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

    /** Fase 2 · perfil laboral (RF-C-01). Sigo en BLANCO hasta que validen. */
    updatePhase2: build.mutation<unknown, UpdatePhase2Request>({
      query: (body) => ({ url: '/workers/me', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'Worker' as const, id: 'ME' }],
    }),

    /** Fase 3 · emergencia y salud (RF-C-02). */
    updatePhase3: build.mutation<unknown, UpdatePhase3Request>({
      query: (body) => ({ url: '/workers/me', method: 'PATCH', body }),
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

    getWorkerCatalogs: build.query<WorkerCatalogs, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchCatalogs(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
    }),
  }),
})

export const {
  useGetMyProfileQuery,
  useUpdatePhase2Mutation,
  useUpdatePhase3Mutation,
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,
  useGetWorkerCatalogsQuery,
} = workerApi
