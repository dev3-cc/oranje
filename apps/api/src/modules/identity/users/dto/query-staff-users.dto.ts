import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const queryStaffUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Busca en nombre y correo. */
  search: z.string().trim().min(1).max(120).optional(),
  roleCode: z.string().trim().toUpperCase().min(1).max(20).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export class QueryStaffUsersDto extends createZodDto(queryStaffUsersSchema) {}
