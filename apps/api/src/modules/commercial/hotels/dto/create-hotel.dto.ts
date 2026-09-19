import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createHotelSchema = z.object({
  name: z.string().trim().min(1).max(160),
  zoneId: z.uuid(),
  timeZone: z.string().trim().min(1).max(64),
  generalPhone: z.string().trim().min(7).max(32).optional(),
  geofenceRadiusM: z.number().int().min(20).max(2000).optional(),
  address: z.string().trim().min(1).max(300).optional(),
  // `photoUrl` ya NO se acepta: la que manda el navegador lleva token de
  // sesion y muere en horas. Se manda el placeId y el servidor resuelve.
  placeId: z.string().trim().min(1).max(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Cómo se poncha en este hotel. Por defecto Selfie; QR para los hoteles que
  // no permiten tomar fotos. Al pasar a QR el servidor genera el código.
  punchMethod: z.enum(['SELFIE', 'QR']).optional(),
})

export class CreateHotelDto extends createZodDto(createHotelSchema) {}
