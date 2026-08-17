import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

const rate = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,4})?$/)
  .optional()

export const createProposalSchema = z.object({
  servicesNote: z.string().trim().min(1).max(4000).optional(),
  payRate: rate,
  billRate: rate,
})

export class CreateProposalDto extends createZodDto(createProposalSchema) {}
