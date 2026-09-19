export interface SessionUser {
  id: string
  name: string
  shortName: string
  roleId: string
  /** La foto firmada de `/me`; `null` sin foto (se pintan iniciales). */
  photoUrl: string | null
  roleCode: string
  roleTitle: string
  hotel: { id: string; name: string } | null
  /** Alcance dentro del hotel (D-09): el Supervisor y el Manager de Área lo tienen; el Manager General no. */
  department: { id: string; name: string } | null
  /** Idioma guardado en la persona (D-36): gana al iniciar sesión. */
  locale: 'es' | 'en'
  permissions: string[]
}
