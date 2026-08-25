export interface SessionUser {
  id: string
  name: string
  shortName: string
  roleId: string
  roleCode: string
  roleTitle: string
  hotel: { id: string; name: string } | null
  permissions: string[]
}
