import type { RoleOption, StaffUser } from '../types/admin.types'

import { registerAdminMocks } from './adminMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, PaginatedEnvelope } from '@/shared/types/apiContract.types'

registerAdminMocks()

export interface StaffUsersQuery {
  search?: string
  roleCode?: string
  includeInactive?: boolean
}

/**
 * `total` viene del `meta` del back, NO de `rows.length`: con `includeInactive`
 * el back pagina a lo más 100 filas (tope real de `queryStaffUsersSchema`),
 * y el personal interno de Oranje ya pasó ese número entre activos e
 * inactivos acumulados — mostrar `rows.length` como "cuántos hay" mentiría
 * apenas hubiera más de una página.
 */
export interface StaffUsersPage {
  rows: StaffUser[]
  total: number
}

export interface CreateStaffUserBody {
  email: string
  fullName: string
  roleCode: string
  reportsToUserId?: string
  password?: string
  sendWelcomeEmail?: boolean
  photoPath?: string
}

export interface UpdateStaffUserBody {
  fullName?: string
  roleCode?: string
  reportsToUserId?: string | null
  isActive?: boolean
  photoPath?: string | null
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStaffRoles: build.query<RoleOption[], void>({
      query: () => ({ url: '/roles' }),
      transformResponse: (response: ApiEnvelope<RoleOption[]>) =>
        response.data.filter((role) => role.code !== 'ROL-SYS-01'),
    }),
    getStaffUsers: build.query<StaffUsersPage, StaffUsersQuery>({
      query: (params) => ({
        url: '/users',
        params: {
          ...(params.search ? { search: params.search } : {}),
          ...(params.roleCode ? { roleCode: params.roleCode } : {}),
          ...(params.includeInactive ? { includeInactive: 'true' } : {}),
          // Tope real del back (`max(100)` en `queryStaffUsersSchema`).
          limit: 100,
        },
      }),
      transformResponse: (response: PaginatedEnvelope<StaffUser>) => ({
        rows: response.data,
        total: response.meta.total,
      }),
      providesTags: ['StaffUser'],
    }),
    createStaffUser: build.mutation<StaffUser, CreateStaffUserBody>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<StaffUser>) => response.data,
      /**
       * El back ya devolvió la fila creada: se SUMA a cada lista cacheada al
       * frente, sin volver a pedir el GET. Un filtro de rol que no lo
       * incluye lo deja fuera, como haría el servidor.
       */
      onQueryStarted: async (_body, api) => {
        const { data: created } = await api.queryFulfilled
        for (const args of adminApi.util.selectCachedArgsForQuery(
          api.getState(),
          'getStaffUsers',
        )) {
          if (args.roleCode && args.roleCode !== created.role.code) continue
          api.dispatch(
            adminApi.util.updateQueryData('getStaffUsers', args, (draft) => {
              if (draft.rows.some((user) => user.id === created.id)) return
              draft.rows.unshift(created)
              draft.total += 1
            }),
          )
        }
      },
    }),
    updateStaffUser: build.mutation<StaffUser, { id: string; body: UpdateStaffUserBody }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      transformResponse: (response: ApiEnvelope<StaffUser>) => response.data,
      invalidatesTags: ['StaffUser'],
    }),
    resendInvitation: build.mutation<StaffUser, string>({
      query: (id) => ({ url: `/users/${id}/resend-invitation`, method: 'POST' }),
      transformResponse: (response: ApiEnvelope<StaffUser>) => response.data,
      invalidatesTags: ['StaffUser'],
    }),
  }),
})

export const {
  useGetStaffRolesQuery,
  useGetStaffUsersQuery,
  useCreateStaffUserMutation,
  useUpdateStaffUserMutation,
  useResendInvitationMutation,
} = adminApi
