import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const ASSIGNMENT_TYPES = ['FIXED', 'TEMPORARY'] as const

export const createAssignmentSchema = z
  .object({
    positionId: z.uuid(),
    workerId: z.uuid(),
    type: z.enum(ASSIGNMENT_TYPES),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((v) => v.type !== 'TEMPORARY' || v.endDate !== undefined, {
    message: 'Una asignación temporal necesita fecha de fin',
    path: ['endDate'],
  })
  .refine((v) => v.type !== 'FIXED' || v.endDate === undefined, {
    message: 'Una asignación fija no lleva fecha de fin',
    path: ['endDate'],
  })

export class CreateAssignmentDto extends createZodDto(createAssignmentSchema) {}
