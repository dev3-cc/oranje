import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const reviewDaySchema = z.object({
  note: z.string().trim().min(1).max(500),
})

export class ReviewDayDto extends createZodDto(reviewDaySchema) {}
