/** Forma de salida pública del personal del sistema. */
export interface StaffUserEntity {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
  reportsToUserId: string | null
  /**
   * URL firmada al leer (D-30): lo que persiste es el path. Si el firmado
   * falla, va `null` sin tumbar el listado.
   */
  photoUrl: string | null
  /**
   * `true` cuando ya se enlazó con su cuenta de Firebase (primer login).
   * Mientras es `false`, la persona existe en Oranje pero aún no entra —
   * es el chip «Invitación enviada» de la maqueta.
   */
  hasAccount: boolean
  isActive: boolean
  createdAt: string
}

/** Los tres códigos que el front necesita distinguir. */
export type InvitationErrorCode = 'FIREBASE_UNAVAILABLE' | 'EMAIL_REJECTED' | 'UNKNOWN'

/**
 * El alta y el reenvío cuentan si el correo SALIÓ. Antes respondían 201 aunque
 * la invitación fallara, y la pantalla decía «Usuario creado» sobre un correo
 * que nunca se mandó.
 *
 * `invitationSent: false` SIN `invitationError` significa que no se pidió
 * ningún correo — alta con contraseña y `sendWelcomeEmail: false`.
 */
export interface StaffUserWithInvitation extends StaffUserEntity {
  invitationSent: boolean
  invitationError?: InvitationErrorCode
}
