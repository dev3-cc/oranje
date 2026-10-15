import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const rejectPayAdjustmentSchema = z.object({
  reason: z.string().trim().min(4).max(500),
})

export class RejectPayAdjustmentDto extends createZodDto(rejectPayAdjustmentSchema) {}
