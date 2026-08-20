import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const PUNCH_TYPES = ['CLOCK_IN', 'LUNCH_OUT', 'LUNCH_IN', 'CLOCK_OUT'] as const
export const LUNCH_TYPES = ['LUNCH_OUT', 'LUNCH_IN'] as const

export const createPunchSchema = z.object({
  assignmentId: z.uuid(),
  type: z.enum(PUNCH_TYPES),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photoPath: z.string().trim().min(1).max(500).optional(),
  deviceAt: z.coerce.date().optional(),
})

export class CreatePunchDto extends createZodDto(createPunchSchema) {}

export const createManualPunchSchema = z.object({
  assignmentId: z.uuid(),
  type: z.enum(PUNCH_TYPES),
  workDate: z.coerce.date(),
  occurredAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(500),
})

export class CreateManualPunchDto extends createZodDto(createManualPunchSchema) {}
