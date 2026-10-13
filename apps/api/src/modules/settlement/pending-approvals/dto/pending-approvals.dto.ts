import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const listPendingApprovalsSchema = z.object({
  hotelId: z.uuid().optional(),
  /** Lunes de la semana, `AAAA-MM-DD`. */
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export class ListPendingApprovalsDto extends createZodDto(listPendingApprovalsSchema) {}
