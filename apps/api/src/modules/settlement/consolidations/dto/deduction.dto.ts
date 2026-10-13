import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const DEDUCTION_TYPES = ['UNIFORM', 'MEALS', 'TAX_RETENTION'] as const

export const createDeductionSchema = z.object({
  type: z.enum(DEDUCTION_TYPES),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/),
  sourceNote: z.string().trim().min(1).max(500).optional(),
})

export class CreateDeductionDto extends createZodDto(createDeductionSchema) {}
