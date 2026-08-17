import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const queryRequisitionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  state: z.string().trim().min(1).optional(),
  hotelId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  urgency: z.string().trim().min(1).optional(),
  includeDeleted: z.coerce.boolean().default(false),
})

export class QueryRequisitionsDto extends createZodDto(queryRequisitionsSchema) {}
