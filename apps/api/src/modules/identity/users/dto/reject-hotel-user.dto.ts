import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/** Mismo patrón que el rechazo del documento SSN/ITIN: motivo obligatorio. */
export const rejectHotelUserSchema = z.object({
  reason: z.string().trim().min(4, 'El motivo debe explicar por qué se rechaza').max(500),
})

export class RejectHotelUserDto extends createZodDto(rejectHotelUserSchema) {}
