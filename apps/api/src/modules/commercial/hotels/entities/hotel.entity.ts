export interface HotelEntity {
  id: string
  name: string
  generalPhone: string | null
  timeZone: string
  geofenceRadiusM: number | null
  address: string | null
  placeId: string | null
  /// URL de media compuesta al leer, no lo que se guarda. Null si el hotel no
  /// tiene foto o si Places no está configurado.
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
  zone: { id: string; code: string; name: string }
  isClient: boolean
  activatedAt: string | null
  contactCount: number
  createdAt: string
  updatedAt: string | null
}
