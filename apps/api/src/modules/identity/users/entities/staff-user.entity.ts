/** Forma de salida pública del personal del sistema. */
export interface StaffUserEntity {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
  reportsToUserId: string | null
  /**
   * `true` cuando ya se enlazó con su cuenta de Firebase (primer login).
   * Mientras es `false`, la persona existe en Oranje pero aún no entra —
   * es el chip «Invitación enviada» de la maqueta.
   */
  hasAccount: boolean
  isActive: boolean
  createdAt: string
}
