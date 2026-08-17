import type { ConversionCandidate, ConversionReadiness } from '../types/conversion.types'

import { registerConversionMocks } from './conversionMocks'

import { baseApi } from '@/app/baseApi'

/**
 * Conversión a cliente activo sobre el `createApi` único (D-12).
 *
 * Todo se etiqueta con `Prospect`: la conversión cambia el semáforo del
 * prospecto, así que aprobarla o devolverlo a Café tiene que refrescar el
 * tablero y su ficha sin que esas pantallas sepan que este módulo existe.
 */
registerConversionMocks()

export const conversionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConversionQueue: build.query<ConversionCandidate[], void>({
      query: () => '/conversion',
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getConversionReadiness: build.query<ConversionReadiness, string>({
      query: (prospectId) => `/prospects/${prospectId}/conversion`,
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    /**
     * Crea el usuario del hotel a partir del contacto principal. Es el único
     * requisito que se resuelve sin salir de esta pantalla.
     */
    createHotelUser: build.mutation<ConversionReadiness, string>({
      query: (prospectId) => ({ url: `/prospects/${prospectId}/hotel-user`, method: 'POST' }),
      invalidatesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    approveConversion: build.mutation<ConversionReadiness, string>({
      query: (prospectId) => ({
        url: `/prospects/${prospectId}/conversion/approvals`,
        method: 'POST',
      }),
      /** También la lista: el hotel sale del pipeline y entra en clientes activos. */
      invalidatesTags: (_result, _error, prospectId) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    /** Devuelve el ciclo a Café: no se cerró el acuerdo y vuelve a negociarse. */
    returnToRenegotiation: build.mutation<ConversionReadiness, string>({
      query: (prospectId) => ({
        url: `/prospects/${prospectId}/conversion/returns`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, prospectId) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetConversionQueueQuery,
  useGetConversionReadinessQuery,
  useCreateHotelUserMutation,
  useApproveConversionMutation,
  useReturnToRenegotiationMutation,
} = conversionApi
