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
  /// SELFIE | QR: cómo se demuestra la presencia al ponchar en este hotel.
  punchMethod: 'SELFIE' | 'QR'
  /// El QR vigente, SIN su secreto: versión y cuándo se generó. `null` si
  /// nunca se ha generado (hotel en Selfie que no ha pasado por QR).
  punchQr: { version: number; generatedAt: string } | null
  contactCount: number
  createdAt: string
  updatedAt: string | null
}
