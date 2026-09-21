import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

export const queryPunchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hotelId: z.uuid().optional(),
})

export class QueryPunchesDto extends createZodDto(queryPunchesSchema) {}
