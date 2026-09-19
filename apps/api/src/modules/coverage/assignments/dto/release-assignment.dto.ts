import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const releaseAssignmentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export class ReleaseAssignmentDto extends createZodDto(releaseAssignmentSchema) {}
