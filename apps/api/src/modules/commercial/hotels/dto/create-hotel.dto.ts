import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createHotelSchema = z.object({
  name: z.string().trim().min(1).max(160),
  zoneId: z.uuid(),
  timeZone: z.string().trim().min(1).max(64),
  generalPhone: z.string().trim().min(7).max(32).optional(),
  geofenceRadiusM: z.number().int().min(20).max(2000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

export class CreateHotelDto extends createZodDto(createHotelSchema) {}
