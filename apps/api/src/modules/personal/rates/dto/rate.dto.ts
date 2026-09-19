import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createRateSchema = z.object({
  rate: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/),
  catalogPositionId: z.uuid().optional(),
  validFrom: z.coerce.date(),
  reason: z.string().trim().min(1).max(500).optional(),
})

export class CreateRateDto extends createZodDto(createRateSchema) {}

export const closeRateSchema = z.object({
  validTo: z.coerce.date(),
})

export class CloseRateDto extends createZodDto(closeRateSchema) {}
