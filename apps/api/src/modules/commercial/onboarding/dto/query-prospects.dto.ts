import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const queryProspectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  state: z.string().trim().toUpperCase().max(24).optional(),
  ownerUserId: z.uuid().optional(),
  zoneId: z.uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  includeClosed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export class QueryProspectsDto extends createZodDto(queryProspectsSchema) {}
