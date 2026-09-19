import type {
  DepartmentOption,
  HotelOption,
  HotelUser,
  RoleOption,
  StaffUser,
} from '../types/admin.types'

import { registerAdminMocks } from './adminMocks'

import { baseApi } from '@/app/baseApi'
import type {
  ApiEnvelope,
  CatalogItemApi,
  HotelApi,
  PaginatedEnvelope,
} from '@/shared/types/apiContract.types'

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

export interface HotelUsersQuery {
  search?: string
  roleCode?: string
  hotelId?: string
  includeInactive?: boolean
}

export interface HotelUsersPage {
  rows: HotelUser[]
  total: number
}

export interface CreateHotelUserBody {
  email: string
  fullName: string
  roleCode: string
  departmentId?: string
  reportsToUserId?: string
}

export interface UpdateHotelUserBody {
  fullName?: string
  departmentId?: string | null
  reportsToUserId?: string | null
  isActive?: boolean
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

    /* ── Cuentas del hotel (users:manage_hotel) ─────────────────────────── */
    getHotelOptions: build.query<HotelOption[], void>({
      query: () => ({ url: '/hotels', params: { limit: 100 } }),
      transformResponse: (response: PaginatedEnvelope<HotelApi>) =>
        response.data
          .map((hotel) => ({ id: hotel.id, name: hotel.name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }),
    getHotelDepartmentOptions: build.query<DepartmentOption[], void>({
      query: () => ({ url: '/catalogs/hotel-departments' }),
      transformResponse: (response: ApiEnvelope<CatalogItemApi[]>) =>
        response.data.map((item) => ({ id: item.id, name: item.name })),
    }),
    getHotelUsers: build.query<HotelUsersPage, HotelUsersQuery>({
      query: (params) => ({
        url: '/hotel-users',
        params: {
          ...(params.search ? { search: params.search } : {}),
          ...(params.roleCode ? { roleCode: params.roleCode } : {}),
          ...(params.hotelId ? { hotelId: params.hotelId } : {}),
          ...(params.includeInactive ? { includeInactive: 'true' } : {}),
          limit: 100,
        },
      }),
      transformResponse: (response: PaginatedEnvelope<HotelUser>) => ({
        rows: response.data,
        total: response.meta.total,
      }),
      providesTags: ['HotelUser'],
    }),
    createHotelUser: build.mutation<HotelUser, { hotelId: string; body: CreateHotelUserBody }>({
      query: ({ hotelId, body }) => ({ url: `/hotels/${hotelId}/users`, method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<HotelUser>) => response.data,
      invalidatesTags: ['HotelUser'],
    }),
    updateHotelUser: build.mutation<
      HotelUser,
      { hotelId: string; id: string; body: UpdateHotelUserBody }
    >({
      query: ({ hotelId, id, body }) => ({
        url: `/hotels/${hotelId}/users/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiEnvelope<HotelUser>) => response.data,
      invalidatesTags: ['HotelUser'],
    }),
    resendHotelInvitation: build.mutation<HotelUser, { hotelId: string; id: string }>({
      query: ({ hotelId, id }) => ({
        url: `/hotels/${hotelId}/users/${id}/resend-invitation`,
        method: 'POST',
      }),
      transformResponse: (response: ApiEnvelope<HotelUser>) => response.data,
      invalidatesTags: ['HotelUser'],
    }),
  }),
})

export const {
  useGetStaffRolesQuery,
  useGetStaffUsersQuery,
  useCreateStaffUserMutation,
  useUpdateStaffUserMutation,
  useResendInvitationMutation,
  useGetHotelOptionsQuery,
  useGetHotelDepartmentOptionsQuery,
  useGetHotelUsersQuery,
  useCreateHotelUserMutation,
  useUpdateHotelUserMutation,
  useResendHotelInvitationMutation,
} = adminApi
