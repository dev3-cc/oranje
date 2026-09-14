/** Un colaborador con cuenta corporativa (`@oranjepeople.com`) en Oranje, y si el buzón REAL ya existe en cPanel. */
export interface CorporateEmailRow {
  workerId: string
  workerName: string
  /** URL firmada de la foto (D-30); `null` sin foto o si el firmado falla. */
  photoUrl: string | null
  email: string
  /** La cuenta de Oranje (`identity.user.is_active`), no el semáforo del colaborador. */
  isActive: boolean
  mailboxExists: boolean
}

/** Solo al crear o resetear: la contraseña nunca se vuelve a mostrar después de esta respuesta. */
export interface MailboxCredential {
  email: string
  password: string
}
