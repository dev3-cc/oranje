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
