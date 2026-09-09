import type { InvitationErrorCode } from './staff-user.entity.js'

export interface HotelUserEntity {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
  hotel: { id: string; name: string }
  department: { id: string; code: string; name: string } | null
  reportsToUserId: string | null
  /** `true` cuando ya se enlazó con su cuenta de Firebase (primer login). */
  hasAccount: boolean
  isActive: boolean
  createdAt: string
}

/** Igual que el personal: el alta y el reenvío cuentan si el correo SALIÓ. */
export interface HotelUserWithInvitation extends HotelUserEntity {
  invitationSent: boolean
  invitationError?: InvitationErrorCode
}
