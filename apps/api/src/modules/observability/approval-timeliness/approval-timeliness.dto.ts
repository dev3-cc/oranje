import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

export const timelinessQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(8),
})

export class TimelinessQueryDto extends createZodDto(timelinessQuerySchema) {}
