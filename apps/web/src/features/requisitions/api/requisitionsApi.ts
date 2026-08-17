import type {
  CreateRequisitionRequest,
  RequisitionBoard,
  RequisitionDetail,
  RequisitionFormOptions,
} from '../types/requisition.types'

import { registerRequisitionsMocks } from './requisitionsMocks'

import { baseApi } from '@/app/baseApi'

/**
 * Tablero de Requisiciones sobre el `createApi` único (D-12).
 *
 * Usa el tag `Requisition`, que ya estaba declarado en `baseApi` desde el
 * andamiaje: la lista de entidades del glosario se fijó antes de que existiera
 * ninguna pantalla que las consumiera.
 */
registerRequisitionsMocks()

export const requisitionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRequisitionBoard: build.query<RequisitionBoard, void>({
      query: () => '/requisitions',
      providesTags: (board) => [
        { type: 'Requisition' as const, id: 'LIST' },
        ...(board?.items ?? []).map((item) => ({ type: 'Requisition' as const, id: item.id })),
      ],
    }),

    /** Catálogos del alta: hoteles con su inspector por zona, áreas y GH. */
    getRequisitionFormOptions: build.query<RequisitionFormOptions, void>({
      query: () => '/requisitions/form-options',
      providesTags: [{ type: 'Catalog' as const, id: 'REQUISITION_FORM' }],
    }),

    createRequisition: build.mutation<RequisitionDetail, CreateRequisitionRequest>({
      query: (body) => ({ url: '/requisitions', method: 'POST', body }),
      /** Cambia el tablero y su métrica de «por autorizar», así que se invalida entero. */
      invalidatesTags: [
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
      ],
    }),

    /**
     * El detalle trae sus posiciones y los slots de cada una en una sola
     * respuesta: son unas decenas de filas, y partirlo en tres peticiones haría
     * que la pantalla se armara a pedazos sin ganar nada.
     */
    getRequisition: build.query<RequisitionDetail, string>({
      query: (requisitionId) => `/requisitions/${requisitionId}`,
      providesTags: (_detail, _error, requisitionId) => [
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),
  }),
})

export const {
  useGetRequisitionBoardQuery,
  useGetRequisitionQuery,
  useGetRequisitionFormOptionsQuery,
  useCreateRequisitionMutation,
} = requisitionsApi
