import { registerMessagingWorkersMocks } from './messagingWorkersMocks'

import { baseApi } from '@/app/baseApi'
/* ⚠ Import entre features, permitido SOLO para registrar mocks (como Mi
   Personal): `/workers` lo simula el Pool. Apagados, no-op. */
// eslint-disable-next-line no-restricted-imports
import { registerPoolMocks } from '@/features/recruitment/api/poolMocks'
import type { PaginatedEnvelope, WorkerApi } from '@/shared/types/apiContract.types'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/* En modo mocks, `/workers` lo simula el Pool: el mismo que usa Mi Personal. */
registerPoolMocks()
registerMessagingWorkersMocks()

export const MESSAGING_WORKERS_PER_PAGE = 20

export interface MessagingWorkersQuery {
  page: number
  search: string
  /** Código del semáforo (`STRONG_GREEN`…); vacío, todos. */
  state: string
  /** Hotel de la asignación ACTIVA; vacío, todos. */
  hotelId: string
}

export interface AssignedHotel {
  id: string
  name: string
}

/**
 * Los colaboradores de Oranje en la sección Contactos de Mensajería, mientras
 * se decide qué hacer con los contactos de la plataforma (Hugo, 2026-10-23).
 *
 * Es el mismo `GET /workers` del Pool y de Mi Personal, con SUS permisos: cada
 * rol ve lo que ya veía (Reclutamiento y QA la ficha completa con teléfono;
 * Contabilidad y el Hotel, la básica sin él) y los demás reciben 403.
 */
export const messagingWorkersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMessagingWorkers: build.query<PaginatedEnvelope<WorkerApi>, MessagingWorkersQuery>({
      query: ({ page, search, state, hotelId }) => ({
        url: '/workers',
        params: {
          page,
          limit: MESSAGING_WORKERS_PER_PAGE,
          ...(search === '' ? {} : { search }),
          ...(state === '' ? {} : { state }),
          ...(hotelId === '' ? {} : { hotelId }),
        },
      }),
      providesTags: ['Worker'],
    }),
    /* Las opciones del filtro por hotel, con el mismo alcance que `/workers`. */
    getMessagingAssignedHotels: build.query<AssignedHotel[], void>({
      query: () => '/workers/assigned-hotels',
      transformResponse: (raw: ApiEnvelope<AssignedHotel[]>) => raw.data,
      providesTags: ['Worker'],
    }),
  }),
})

export const { useGetMessagingWorkersQuery } = messagingWorkersApi
export const { useGetMessagingAssignedHotelsQuery } = messagingWorkersApi
