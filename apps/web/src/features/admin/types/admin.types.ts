export interface StaffUser {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
  reportsToUserId: string | null
  photoUrl?: string | null
  hasAccount: boolean
  isActive: boolean
  createdAt: string
}

export interface RoleOption {
  code: string
  name: string
  department?: string
}

export type AccessMode = 'INVITATION' | 'PASSWORD'

/**
 * Cuenta del hotel (Supervisor, Manager de Área, Manager General). El primer
 * Manager General nace en la Conversión; el resto lo administra el
 * Administrador (Reglas de Negocio · Cuentas del hotel).
 */
export interface HotelUser {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
  hotel: { id: string; name: string }
  department: { id: string; code: string; name: string } | null
  reportsToUserId: string | null
  hasAccount: boolean
  isActive: boolean
  createdAt: string
  /** Solo al crear o reenviar: si el correo de invitación SALIÓ. */
  invitationSent?: boolean
}

export interface HotelOption {
  id: string
  name: string
}

export interface DepartmentOption {
  id: string
  name: string
}

export const HOTEL_ROLE_OPTIONS: readonly RoleOption[] = [
  { code: 'ROL-H-01', name: 'Supervisor' },
  { code: 'ROL-H-02', name: 'Manager de Área' },
  { code: 'ROL-H-03', name: 'Manager General' },
]

export const HOTEL_GENERAL_MANAGER = 'ROL-H-03'

/** A quién reporta cada rol del hotel, dentro de su hotel (Reglas de Negocio · Cuentas del hotel). */
export const HOTEL_SUPERIOR_ROLES: Record<string, readonly string[]> = {
  'ROL-H-01': ['ROL-H-02', 'ROL-H-03'],
  'ROL-H-02': ['ROL-H-03'],
  'ROL-H-03': [],
}
