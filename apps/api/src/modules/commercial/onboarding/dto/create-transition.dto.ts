import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createTransitionSchema = z.object({
  toState: z.string().trim().toUpperCase().min(1).max(24),
  reasonCode: z.string().trim().toUpperCase().min(1).max(48).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
})

export class CreateTransitionDto extends createZodDto(createTransitionSchema) {}
