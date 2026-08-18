import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import { selectAccessToken } from './sessionSlice'

import { withMocks } from '@/shared/lib/mockBaseQuery'

/**
 * UN SOLO `createApi` para toda la app (D-12).
 *
 * Cada feature agrega los suyos con `baseApi.injectEndpoints`. Si cada feature
 * crea su propio createApi se pierde la invalidación cruzada por tags
 * —autorizar una requisición deja de refrescar el Schedule— y aparecen tantas
 * cachés como features.
 *
 * Los hooks se GENERAN (`useGetRequisitionsQuery`); no se escriben a mano ni se
 * envuelven en un hook propio salvo que agregue lógica real.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  /**
   * `withMocks` es un envoltorio temporal: con `VITE_USE_MOCKS` apagado
   * devuelve este mismo `fetchBaseQuery` sin tocar nada. Los endpoints se
   * declaran siempre con su URL y método definitivos.
   */
  baseQuery: withMocks(
    fetchBaseQuery({
      baseUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
      /**
       * El Bearer es el ACCESS TOKEN de la API (`POST /auth/session`), no el
       * idToken de Firebase: el guard global de `apps/api` solo valida el
       * suyo. El idToken se usa una vez, al canjear la sesión en el login.
       */
      prepareHeaders: (headers, { getState }) => {
        const token = selectAccessToken(getState() as Parameters<typeof selectAccessToken>[0])
        if (token) headers.set('authorization', `Bearer ${token}`)
        return headers
      },
    }),
  ),
  /** Un tag por entidad del glosario canónico (§8 de Estructura de Proyecto). */
  tagTypes: [
    'Requisition',
    'Position',
    'Slot',
    'Worker',
    'Assignment',
    'Schedule',
    'Timesheet',
    'PunchMark',
    'Prospect',
    'Hotel',
    'Contract',
    'WeeklyConsolidation',
    'Invoice',
    'WorkAccident',
    'BlacklistEntry',
    'Catalog',
  ],
  endpoints: () => ({}),
})
