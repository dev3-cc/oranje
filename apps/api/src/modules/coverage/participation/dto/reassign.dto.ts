import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const reassignSchema = z.object({
  toUserId: z.uuid(),
})

export class ReassignDto extends createZodDto(reassignSchema) {}
