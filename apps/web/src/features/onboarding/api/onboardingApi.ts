import type {
  AllowedTransitions,
  ChangeStatusRequest,
  ContactAttempt,
  CreateProspectRequest,
  HotelContactPayload,
  PipelineBoard,
  PipelineFilters,
  ProspectDetail,
  RegisterContactAttemptRequest,
  StatusChangeReason,
  RegisteredHotel,
  UpdateProspectRequest,
  Zone,
} from '../types/prospect.types'

import { registerOnboardingMocks } from './onboardingMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Endpoints de Onboarding sobre el `createApi` único (D-12).
 *
 * Las URLs y los métodos son los DEFINITIVOS: hoy los atiende la capa de
 * fixtures porque `apps/api` todavía no los expone, pero ni este archivo ni
 * ningún componente saben de eso. Apagar `VITE_USE_MOCKS` es todo lo que hay
 * que hacer el día que el backend exista.
 *
 * Los hooks se GENERAN — no se escriben a mano ni se envuelven sin necesidad.
 */
registerOnboardingMocks()

export const onboardingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPipelineBoard: build.query<PipelineBoard, PipelineFilters>({
      query: (filters) => ({
        url: '/prospects',
        params: {
          ...(filters.zone ? { zone: filters.zone } : {}),
          ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
          ...(filters.staleDays ? { staleDays: filters.staleDays } : {}),
        },
      }),
      providesTags: (board) => [
        { type: 'Prospect' as const, id: 'LIST' },
        ...(board?.items ?? []).map((item) => ({ type: 'Prospect' as const, id: item.id })),
      ],
    }),

    getProspect: build.query<ProspectDetail, string>({
      query: (prospectId) => `/prospects/${prospectId}`,
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    /** Filtradas por el rol de quien pregunta: el front nunca decide permisos. */
    getAllowedTransitions: build.query<AllowedTransitions, string>({
      query: (prospectId) => `/prospects/${prospectId}/allowed-transitions`,
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    getZones: build.query<Zone[], void>({
      query: () => '/catalogs/zones',
      providesTags: [{ type: 'Catalog', id: 'ZONE' }],
    }),

    /** Alta del hotel en el pipeline. Nace en GRIS: el semáforo lo fija el backend. */
    createProspect: build.mutation<ProspectDetail, CreateProspectRequest>({
      query: (body) => ({ url: '/prospects', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Prospect', id: 'LIST' },
        { type: 'Hotel', id: 'LIST' },
      ],
    }),

    /**
     * Alta de contactos en LOTE.
     *
     * Un solo `POST` con todos porque `ux_hotel_contact_primary` obliga a que
     * quitarle el principal al anterior y dárselo al nuevo pase en la misma
     * transacción; en dos llamadas, el motor rechaza la segunda.
     */
    addHotelContacts: build.mutation<
      ProspectDetail,
      { prospectId: string; contacts: HotelContactPayload[] }
    >({
      query: ({ prospectId, contacts }) => ({
        url: `/prospects/${prospectId}/contacts`,
        method: 'POST',
        body: { contacts },
      }),
      invalidatesTags: (_result, _error, { prospectId }) => [{ type: 'Prospect', id: prospectId }],
    }),

    /** Hoteles ya registrados sin ciclo abierto: un hotel no tiene dos a la vez. */
    getRegisteredHotels: build.query<RegisteredHotel[], void>({
      query: () => ({ url: '/hotels', params: { withoutOpenCycle: true } }),
      providesTags: [{ type: 'Hotel', id: 'LIST' }],
    }),

    updateProspect: build.mutation<ProspectDetail, UpdateProspectRequest>({
      query: ({ prospectId, ...body }) => ({
        url: `/prospects/${prospectId}`,
        method: 'PATCH',
        body,
      }),
      /** También la lista: cambiar zona o nombre altera la tarjeta del tablero. */
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    getStatusChangeReasons: build.query<StatusChangeReason[], OnboardingStatus>({
      query: (toStatus) => ({ url: '/catalogs/status-change-reasons', params: { toStatus } }),
      providesTags: [{ type: 'Catalog', id: 'STATUS_CHANGE_REASON' }],
    }),

    /**
     * Devuelve el intento creado (201 Created), no el prospecto completo: es lo
     * convencional para un POST de recurso y es lo que va a implementar
     * `apps/api`. La bitácora se refresca por la invalidación del tag.
     */
    registerContactAttempt: build.mutation<ContactAttempt, RegisterContactAttemptRequest>({
      query: ({ prospectId, ...body }) => ({
        url: `/prospects/${prospectId}/contact-attempts`,
        method: 'POST',
        body,
      }),
      /** También la lista: el tablero muestra el último intento en la tarjeta. */
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    changeProspectStatus: build.mutation<ProspectDetail, ChangeStatusRequest>({
      query: ({ prospectId, ...body }) => ({
        url: `/prospects/${prospectId}/status-changes`,
        method: 'POST',
        body,
      }),
      /**
       * Invalida el prospecto Y la lista: cambiar de estado lo mueve de columna
       * en el tablero, así que la vista anterior queda mintiendo.
       */
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetPipelineBoardQuery,
  useGetProspectQuery,
  useGetAllowedTransitionsQuery,
  useGetZonesQuery,
  useCreateProspectMutation,
  useAddHotelContactsMutation,
  useGetRegisteredHotelsQuery,
  useUpdateProspectMutation,
  useGetStatusChangeReasonsQuery,
  useRegisterContactAttemptMutation,
  useChangeProspectStatusMutation,
} = onboardingApi
