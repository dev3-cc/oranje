import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const hoursWeekNoticeSchema = z.object({
  /** Lunes de una semana cerrada. Sin él, cada hotel recibe la que cerró en su zona. */
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Solo ese hotel (reenviar a uno). */
  hotelId: z.uuid().optional(),
})

export class HoursWeekNoticeDto extends createZodDto(hoursWeekNoticeSchema) {}
