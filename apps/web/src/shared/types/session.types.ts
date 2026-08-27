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
  permissions: string[]
}
