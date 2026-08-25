import { baseApi } from './baseApi'
import { sessionCleared, sessionEstablished } from './sessionSlice'

import { roleLabelOf } from '@/shared/constants/roles'
import { registerMockRoutes } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, MeApi, SessionApi } from '@/shared/types/apiContract.types'
import type { SessionUser } from '@/shared/types/session.types'

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
    roleId: session.user.roleCode,
    roleCode: role.short,
    roleTitle: role.title,
    hotel: null,
    permissions: [],
  }
}

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
        permissions: [
          'pipeline.read',
          'pipeline.create_prospect',
          'proposals.read',
          'blacklist.read',
          'blacklist.create',
          'blacklist.lift',
        ],
      },
    }),
  },
])

let lastAccessToken = ''

function captureToken(raw: ApiEnvelope<SessionApi>): SessionUser {
  lastAccessToken = raw.data.accessToken
  return adaptSessionUser(raw.data)
}

export const sessionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSession: build.query<SessionUser, void>({
      query: () => '/me',
      transformResponse: (raw: ApiEnvelope<MeApi>): SessionUser => ({
        id: raw.data.id,
        name: raw.data.fullName,
        shortName: toShortName(raw.data.fullName),
        roleId: raw.data.role.code,
        roleCode: roleLabelOf(raw.data.role.code).short,
        roleTitle: raw.data.role.name,
        hotel: raw.data.hotel,
        permissions: raw.data.permissions,
      }),
    }),

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
          dispatch(baseApi.util.resetApiState())
          dispatch(sessionEstablished({ user: data, accessToken: lastAccessToken }))
        } catch {
          dispatch(sessionCleared())
        }
      },
    }),

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

    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST', credentials: 'include' }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled
        } finally {
          dispatch(sessionCleared())
          dispatch(baseApi.util.resetApiState())
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
