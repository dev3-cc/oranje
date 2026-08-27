import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'

import { selectAccessToken, sessionCleared, sessionEstablished } from './sessionSlice'

import { roleLabelOf } from '@/shared/constants/roles'
import { withMocks } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, SessionApi } from '@/shared/types/apiContract.types'

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
const rawBaseQuery = withMocks(
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
)

/**
 * Un solo refresh en vuelo: cuando el access token caduca (vive 15 min),
 * todas las consultas del momento fallan con 401 a la vez — sin este
 * candado cada una dispararía su propio `POST /auth/refresh`.
 */
let refreshInFlight: Promise<boolean> | null = null

/**
 * Reauth transparente: un 401 intenta UNA vez el refresh con la cookie y
 * reintenta la consulta original. Sin esto, a los 15 minutos toda página
 * nueva moría hasta recargar el navegador (que era lo único que refrescaba).
 * Si el refresh también falla, la sesión de verdad murió: al login.
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  const url = typeof args === 'string' ? args : args.url
  const isAuthCall = url.startsWith('/auth/')

  if (result.error?.status === 401 && !isAuthCall) {
    refreshInFlight ??= Promise.resolve(
      rawBaseQuery(
        { url: '/auth/refresh', method: 'POST', credentials: 'include' },
        api,
        extraOptions,
      ),
    )
      .then((refresh) => {
        if (refresh.error) return false
        const session = (refresh.data as ApiEnvelope<SessionApi>).data
        const role = roleLabelOf(session.user.roleCode)
        api.dispatch(
          sessionEstablished({
            user: {
              id: session.user.id,
              name: session.user.fullName,
              shortName: session.user.fullName,
              roleId: session.user.roleCode,
              photoUrl: null,
              roleCode: role.short,
              roleTitle: role.title,
              hotel: null,
              permissions: [],
            },
            accessToken: session.accessToken,
          }),
        )
        return true
      })
      .finally(() => {
        refreshInFlight = null
      })

    if (await refreshInFlight) {
      result = await rawBaseQuery(args, api, extraOptions)
    } else {
      api.dispatch(sessionCleared())
    }
  }

  return result
}

export const baseApi = createApi({
  reducerPath: 'api',
  /**
   * `withMocks` es un envoltorio temporal: con `VITE_USE_MOCKS` apagado
   * devuelve este mismo `fetchBaseQuery` sin tocar nada. Los endpoints se
   * declaran siempre con su URL y método definitivos.
   */
  baseQuery: baseQueryWithReauth,
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
    'StaffUser',
  ],
  endpoints: () => ({}),
})
