import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const queryHotelsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  zoneId: z.uuid().optional(),
  onlyClients: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export class QueryHotelsDto extends createZodDto(queryHotelsSchema) {}
