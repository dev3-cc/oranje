import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const SOURCES = ['MANUAL', 'ABSENCES', 'DISPUTE'] as const

export const createEntrySchema = z
  .object({
    source: z.enum(SOURCES),
    reason: z.string().trim().min(1).max(1000),
    evidencePath: z.string().trim().min(1).max(500).optional(),
  })
  .refine((v) => v.source !== 'MANUAL' || v.evidencePath !== undefined, {
    message: 'Un veto manual necesita evidencia',
    path: ['evidencePath'],
  })

export class CreateEntryDto extends createZodDto(createEntrySchema) {}

export const liftSchema = z.object({
  liftReason: z.string().trim().min(1).max(1000),
})

export class LiftDto extends createZodDto(liftSchema) {}
