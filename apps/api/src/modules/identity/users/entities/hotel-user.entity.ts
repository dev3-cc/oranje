export interface HotelUserEntity {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
  department: { id: string; code: string; name: string } | null
  reportsToUserId: string | null
  hasAccount: boolean
  isActive: boolean
  createdAt: string
}
