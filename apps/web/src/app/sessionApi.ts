import { baseApi } from './baseApi'
import { sessionCleared, sessionEstablished } from './sessionSlice'

import { roleLabelOf } from '@/shared/constants/roles'
import { registerMockRoutes } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, MeApi, SessionApi } from '@/shared/types/apiContract.types'
import type { SessionUser } from '@/shared/types/session.types'

/**
 * La conversación de auth con `apps/api` (identity §1). Vive en `app/` y no en
 * la feature de login porque el resultado —la sesión— lo consume el shell
 * entero, y el refresh en 401 lo necesita cualquier feature.
 *
 * Las tres mutaciones escriben su resultado en `sessionSlice` vía
 * `onQueryStarted`: los componentes leen la sesión del slice, nunca de la
 * caché de estas mutaciones.
 */

/** `Ana Ruiz` → `A. Ruiz`. Misma regla que las tarjetas del tablero. */
function toShortName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/)
  if (!first || rest.length === 0) return fullName
  return `${first[0]}. ${rest.join(' ')}`
}

function adaptSessionUser(session: SessionApi): SessionUser {
  const role = roleLabelOf(session.user.roleCode)
  return {
    id: session.user.id,
    name: session.user.fullName,
    shortName: toShortName(session.user.fullName),
    roleCode: role.short,
    roleTitle: role.title,
  }
}

/**
 * MOCK de `identity/auth`. La «cookie» del refresh se simula con una bandera
 * en localStorage: existe tras un login y sobrevive la recarga, igual que la
 * cookie real; `logout` la borra. Fuera de modo mock nada de esto se registra.
 */
const MOCK_SESSION_FLAG = 'oranje-mock-session'

const MOCK_SESSION: SessionApi = {
  accessToken: 'mock-access-token',
  expiresIn: 900,
  user: {
    id: 'usr-ana-ruiz',
    email: 'ana.ruiz@oranje.mx',
    fullName: 'Ana Ruiz',
    roleCode: 'ROL-V-01',
  },
}

registerMockRoutes([
  {
    method: 'POST',
    path: '/auth/session',
    resolve: (): ApiEnvelope<SessionApi> => {
      localStorage.setItem(MOCK_SESSION_FLAG, 'true')
      return { data: MOCK_SESSION }
    },
  },
  {
    method: 'POST',
    path: '/auth/refresh',
    resolve: (): ApiEnvelope<SessionApi> => {
      if (localStorage.getItem(MOCK_SESSION_FLAG) !== 'true') {
        throw new Error('REFRESH_MISSING')
      }
      return { data: MOCK_SESSION }
    },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    resolve: (): null => {
      localStorage.removeItem(MOCK_SESSION_FLAG)
      return null
    },
  },
  {
    method: 'GET',
    path: '/me',
    resolve: (): ApiEnvelope<MeApi> => ({
      data: {
        id: MOCK_SESSION.user.id,
        email: MOCK_SESSION.user.email,
        fullName: MOCK_SESSION.user.fullName,
        role: {
          code: MOCK_SESSION.user.roleCode,
          name: 'Business Developer',
          department: 'Ventas',
        },
        hotel: null,
        department: null,
        zones: [],
        permissions: ['pipeline.read', 'pipeline.create_prospect', 'proposals.read'],
      },
    }),
  },
])

/**
 * El accessToken llega en la MISMA respuesta que el usuario, pero a la caché
 * de RTK Query solo debe entrar el `SessionUser`: el token no es estado de la
 * UI ni debe quedar inspeccionable en la caché. `captureToken` lo aparta en el
 * transform y `onQueryStarted` lo recoge para el slice.
 */
let lastAccessToken = ''

function captureToken(raw: ApiEnvelope<SessionApi>): SessionUser {
  lastAccessToken = raw.data.accessToken
  return adaptSessionUser(raw.data)
}

export const sessionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** El `/me` real: rol con su nombre del catálogo, no del mapa de etiquetas. */
    getSession: build.query<SessionUser, void>({
      query: () => '/me',
      transformResponse: (raw: ApiEnvelope<MeApi>): SessionUser => ({
        id: raw.data.id,
        name: raw.data.fullName,
        shortName: toShortName(raw.data.fullName),
        roleCode: roleLabelOf(raw.data.role.code).short,
        roleTitle: raw.data.role.name,
      }),
    }),

    /**
     * Login: canjea el idToken de Firebase por la sesión de la API (201).
     * `credentials: 'include'` para recibir la cookie `oranje_refresh`.
     */
    createSession: build.mutation<SessionUser, { idToken: string }>({
      query: (body) => ({
        url: '/auth/session',
        method: 'POST',
        body,
        credentials: 'include',
      }),
      transformResponse: captureToken,
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          dispatch(sessionEstablished({ user: data, accessToken: lastAccessToken }))
        } catch {
          dispatch(sessionCleared())
        }
      },
    }),

    /** Reanuda la sesión desde la cookie. Es lo primero que intenta el guard. */
    refreshSession: build.mutation<SessionUser, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST', credentials: 'include' }),
      transformResponse: captureToken,
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          dispatch(sessionEstablished({ user: data, accessToken: lastAccessToken }))
        } catch {
          dispatch(sessionCleared())
        }
      },
    }),

    /** 204 siempre: la API no falla el logout a propósito (no filtra tokens). */
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST', credentials: 'include' }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled
        } finally {
          dispatch(sessionCleared())
        }
      },
    }),
  }),
})

export const {
  useGetSessionQuery,
  useCreateSessionMutation,
  useRefreshSessionMutation,
  useLogoutMutation,
} = sessionApi
