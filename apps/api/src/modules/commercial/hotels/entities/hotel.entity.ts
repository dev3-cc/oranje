export interface HotelEntity {
  id: string
  name: string
  generalPhone: string | null
  timeZone: string
  geofenceRadiusM: number | null
  latitude: number | null
  longitude: number | null
  zone: { id: string; code: string; name: string }
  isClient: boolean
  activatedAt: string | null
  contactCount: number
  createdAt: string
  updatedAt: string | null
}
