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
  // Datos contables (Hugo, 2026-10-07): se capturan al dar de alta y el
  // Contrato los hereda de aquí sin volver a pedirlos. REQUERIDOS, sin
  // default: no se inventa un cierre de semana ni un recargo de overtime.
  weekStartDay: z.number().int().min(0).max(6),
  weekEndDay: z.number().int().min(0).max(6),
  // 0 = no paga horas extra; 1.5 = tiempo y medio (Hugo, 2026-10-07).
  overtimePayMultiplier: z.union([z.literal(0), z.literal(1.5)]),
  // `true`: el hotel paga el lonche, las horas quedan completas. Opcional
  // (la base ya parte en `false`, el de hoy) — a diferencia de los otros
  // datos contables, Contabilidad lo ajusta después desde el Timesheet, no
  // hace falta decidirlo al dar de alta (Hugo, 2026-10-14).
  paysLunch: z.boolean().optional(),
})

export class CreateHotelDto extends createZodDto(createHotelSchema) {}
