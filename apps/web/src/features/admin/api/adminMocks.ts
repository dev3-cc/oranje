import type { HotelUser, RoleOption, StaffUser } from '../types/admin.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type {
  ApiEnvelope,
  CatalogItemApi,
  HotelApi,
  PaginatedEnvelope,
} from '@/shared/types/apiContract.types'

const ROLES: RoleOption[] = [
  { code: 'ROL-V-01', name: 'Business Developer' },
  { code: 'ROL-V-02', name: 'BD Coordinator' },
  { code: 'ROL-R-01', name: 'Reclutadora' },
  { code: 'ROL-R-02', name: 'Líder de Grupo de Reclutadoras' },
  { code: 'ROL-R-03', name: 'Manager de Reclutamiento' },
  { code: 'ROL-I-01', name: 'Inspector' },
  { code: 'ROL-I-02', name: 'Coordinador de Inspección' },
  { code: 'ROL-CT-01', name: 'Manager de Contabilidad' },
  { code: 'ROL-CT-02', name: 'Contadora' },
  { code: 'ROL-ADM-01', name: 'Administrador' },
]

const USERS: StaffUser[] = [
  {
    id: 'usr-hugo',
    email: 'hugo@casacurtidor.com',
    fullName: 'Hugo Curtidor',
    role: { code: 'ROL-V-01', name: 'Business Developer' },
    reportsToUserId: 'usr-oliver',
    photoUrl: null,
    hasAccount: true,
    isActive: true,
    createdAt: '2026-08-19T12:00:00.000Z',
  },
  {
    id: 'usr-oliver',
    email: 'bdc@casacurtidor.com',
    fullName: 'Oliver Craig',
    role: { code: 'ROL-V-02', name: 'BD Coordinator' },
    reportsToUserId: null,
    photoUrl: null,
    hasAccount: true,
    isActive: true,
    createdAt: '2026-08-19T12:00:00.000Z',
  },
  {
    id: 'usr-marta',
    email: 'reclutadora@casacurtidor.com',
    fullName: 'Marta Solís',
    role: { code: 'ROL-R-01', name: 'Reclutadora' },
    reportsToUserId: 'usr-laura',
    photoUrl: null,
    hasAccount: true,
    isActive: true,
    createdAt: '2026-08-21T12:00:00.000Z',
  },
  {
    id: 'usr-laura',
    email: 'lider-reclutadoras@casacurtidor.com',
    fullName: 'Laura Peña',
    role: { code: 'ROL-R-02', name: 'Líder de Grupo de Reclutadoras' },
    reportsToUserId: 'usr-ivan',
    photoUrl: null,
    hasAccount: true,
    isActive: true,
    createdAt: '2026-08-21T12:00:00.000Z',
  },
  {
    id: 'usr-ivan',
    email: 'mgr-reclutamiento@casacurtidor.com',
    fullName: 'Iván Mora',
    role: { code: 'ROL-R-03', name: 'Manager de Reclutamiento' },
    reportsToUserId: null,
    photoUrl: null,
    hasAccount: false,
    isActive: true,
    createdAt: '2026-08-25T12:00:00.000Z',
  },
  {
    id: 'usr-sofia',
    email: 'sofia@casacurtidor.com',
    fullName: 'Sofía Vega',
    role: { code: 'ROL-CT-02', name: 'Contadora' },
    reportsToUserId: null,
    photoUrl: null,
    hasAccount: true,
    isActive: false,
    createdAt: '2026-07-02T12:00:00.000Z',
  },
]

const HOTELS: Array<Pick<HotelApi, 'id' | 'name'>> = [
  { id: 'hotel-xcaret', name: 'Hotel Xcaret' },
  { id: 'hotel-xcaret-mexico', name: 'Hotel Xcaret México' },
]

const DEPARTMENTS: CatalogItemApi[] = [
  { id: 'dep-housekeeping', code: 'HOUSEKEEPING', name: 'Housekeeping' },
  { id: 'dep-cocina', code: 'KITCHEN', name: 'Cocina' },
]

const HOTEL_USERS: HotelUser[] = [
  {
    id: 'husr-diego',
    email: 'mgr-general-xcaret@casacurtidor.com',
    fullName: 'Diego Ramírez',
    role: { code: 'ROL-H-03', name: 'Manager General' },
    hotel: { id: 'hotel-xcaret', name: 'Hotel Xcaret' },
    department: null,
    reportsToUserId: null,
    hasAccount: true,
    isActive: true,
    createdAt: '2026-08-20T12:00:00.000Z',
  },
  {
    id: 'husr-paola',
    email: 'mgr-area-xcaret@casacurtidor.com',
    fullName: 'Paola Herrera',
    role: { code: 'ROL-H-02', name: 'Manager de Área' },
    hotel: { id: 'hotel-xcaret', name: 'Hotel Xcaret' },
    department: { id: 'dep-housekeeping', code: 'HOUSEKEEPING', name: 'Housekeeping' },
    reportsToUserId: 'husr-diego',
    hasAccount: true,
    isActive: true,
    createdAt: '2026-08-22T12:00:00.000Z',
  },
  {
    id: 'husr-aldo',
    email: 'supervisor@casacurtidor.com',
    fullName: 'Aldo Castillo',
    role: { code: 'ROL-H-01', name: 'Supervisor' },
    hotel: { id: 'hotel-xcaret', name: 'Hotel Xcaret' },
    department: { id: 'dep-housekeeping', code: 'HOUSEKEEPING', name: 'Housekeeping' },
    reportsToUserId: 'husr-paola',
    hasAccount: false,
    isActive: true,
    createdAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'husr-rene',
    email: 'rene@xcaretmexico.local',
    fullName: 'René Ochoa',
    role: { code: 'ROL-H-01', name: 'Supervisor' },
    hotel: { id: 'hotel-xcaret-mexico', name: 'Hotel Xcaret México' },
    department: { id: 'dep-cocina', code: 'KITCHEN', name: 'Cocina' },
    reportsToUserId: null,
    hasAccount: true,
    isActive: false,
    createdAt: '2026-07-15T12:00:00.000Z',
  },
]

const HOTEL_ROLE_NAMES: Record<string, string> = {
  'ROL-H-01': 'Supervisor',
  'ROL-H-02': 'Manager de Área',
  'ROL-H-03': 'Manager General',
}

let nextId = 1

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/roles',
    resolve: (): ApiEnvelope<RoleOption[]> => ({ data: ROLES }),
  },
  {
    method: 'GET',
    path: '/users',
    resolve: (request): PaginatedEnvelope<StaffUser> => {
      const search = request.search.get('search')?.toLowerCase() ?? ''
      const roleCode = request.search.get('roleCode')
      const includeInactive = request.search.get('includeInactive') === 'true'

      const items = USERS.filter((user) => {
        if (!includeInactive && !user.isActive) return false
        if (roleCode && user.role.code !== roleCode) return false
        if (
          search &&
          !user.fullName.toLowerCase().includes(search) &&
          !user.email.toLowerCase().includes(search)
        )
          return false
        return true
      })

      return {
        data: items,
        meta: { page: 1, limit: 20, total: items.length, totalPages: 1 },
      }
    },
  },
  {
    method: 'POST',
    path: '/users',
    resolve: (request): ApiEnvelope<StaffUser> => {
      const body = request.body as {
        email: string
        fullName: string
        roleCode: string
        reportsToUserId?: string
      }
      const role = ROLES.find((item) => item.code === body.roleCode)
      const user: StaffUser = {
        id: `usr-new-${String(nextId++)}`,
        email: body.email,
        fullName: body.fullName,
        role: role ?? { code: body.roleCode, name: body.roleCode },
        reportsToUserId: body.reportsToUserId ?? null,
        photoUrl: null,
        hasAccount: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      USERS.unshift(user)
      return { data: user }
    },
  },
  {
    method: 'PATCH',
    path: '/users/:userId',
    resolve: (request): ApiEnvelope<StaffUser> => {
      const user = USERS.find((item) => item.id === request.params.userId)
      if (!user) throw new Error('usuario no encontrado en el mock')
      const body = request.body as Partial<{
        fullName: string
        roleCode: string
        reportsToUserId: string | null
        isActive: boolean
      }>
      if (body.fullName !== undefined) user.fullName = body.fullName
      if (body.roleCode !== undefined) {
        user.role = ROLES.find((item) => item.code === body.roleCode) ?? {
          code: body.roleCode,
          name: body.roleCode,
        }
      }
      if (body.reportsToUserId !== undefined) user.reportsToUserId = body.reportsToUserId
      if (body.isActive !== undefined) user.isActive = body.isActive
      return { data: user }
    },
  },
  {
    method: 'GET',
    path: '/hotels',
    resolve: (): PaginatedEnvelope<HotelApi> => ({
      data: HOTELS as HotelApi[],
      meta: { page: 1, limit: 100, total: HOTELS.length, totalPages: 1 },
    }),
  },
  {
    method: 'GET',
    path: '/catalogs/hotel-departments',
    resolve: (): ApiEnvelope<CatalogItemApi[]> => ({ data: DEPARTMENTS }),
  },
  {
    method: 'GET',
    path: '/hotel-users',
    resolve: (request): PaginatedEnvelope<HotelUser> => {
      const search = request.search.get('search')?.toLowerCase() ?? ''
      const roleCode = request.search.get('roleCode')
      const hotelId = request.search.get('hotelId')
      const includeInactive = request.search.get('includeInactive') === 'true'

      const items = HOTEL_USERS.filter((user) => {
        if (!includeInactive && !user.isActive) return false
        if (roleCode && user.role.code !== roleCode) return false
        if (hotelId && user.hotel.id !== hotelId) return false
        if (
          search &&
          !user.fullName.toLowerCase().includes(search) &&
          !user.email.toLowerCase().includes(search) &&
          !user.hotel.name.toLowerCase().includes(search)
        )
          return false
        return true
      })

      return {
        data: items.map((user) => ({ ...user })),
        meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
      }
    },
  },
  {
    method: 'POST',
    path: '/hotels/:hotelId/users',
    resolve: (request): ApiEnvelope<HotelUser> => {
      const hotel = HOTELS.find((item) => item.id === request.params.hotelId)
      if (!hotel) throw new Error(`No existe el hotel ${String(request.params.hotelId)}`)
      const body = request.body as {
        email: string
        fullName: string
        roleCode: string
        departmentId?: string
        reportsToUserId?: string
      }
      const department = DEPARTMENTS.find((item) => item.id === body.departmentId) ?? null
      const user: HotelUser = {
        id: `husr-new-${String(nextId++)}`,
        email: body.email,
        fullName: body.fullName,
        role: { code: body.roleCode, name: HOTEL_ROLE_NAMES[body.roleCode] ?? body.roleCode },
        hotel: { id: hotel.id, name: hotel.name },
        department,
        reportsToUserId: body.reportsToUserId ?? null,
        hasAccount: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      HOTEL_USERS.unshift(user)
      return { data: { ...user, invitationSent: true } }
    },
  },
  {
    method: 'PATCH',
    path: '/hotels/:hotelId/users/:userId',
    resolve: (request): ApiEnvelope<HotelUser> => {
      const user = HOTEL_USERS.find(
        (item) => item.id === request.params.userId && item.hotel.id === request.params.hotelId,
      )
      if (!user) throw new Error(`No existe la cuenta ${String(request.params.userId)}`)
      const body = request.body as {
        fullName?: string
        departmentId?: string | null
        reportsToUserId?: string | null
        isActive?: boolean
      }
      if (body.fullName !== undefined) user.fullName = body.fullName
      if (body.departmentId !== undefined)
        user.department = DEPARTMENTS.find((item) => item.id === body.departmentId) ?? null
      if (body.reportsToUserId !== undefined) user.reportsToUserId = body.reportsToUserId
      if (body.isActive !== undefined) user.isActive = body.isActive
      return { data: { ...user } }
    },
  },
  {
    method: 'POST',
    path: '/hotels/:hotelId/users/:userId/resend-invitation',
    resolve: (request): ApiEnvelope<HotelUser> => {
      const user = HOTEL_USERS.find((item) => item.id === request.params.userId)
      if (!user) throw new Error(`No existe la cuenta ${String(request.params.userId)}`)
      return { data: { ...user, invitationSent: true } }
    },
  },
  {
    method: 'POST',
    path: '/users/:userId/resend-invitation',
    resolve: (request): ApiEnvelope<StaffUser> => {
      const user = USERS.find((item) => item.id === request.params.userId)
      if (!user) throw new Error('usuario no encontrado en el mock')
      return { data: user }
    },
  },
]

let areRoutesRegistered = false

export function registerAdminMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
