import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const positionSchema = z.object({
  catalogPositionId: z.uuid(),
  hiringModalityId: z.uuid(),
  hotelDepartmentId: z.uuid(),
  englishLevelId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(200),
  startDate: z.coerce.date(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
})

export const createRequisitionSchema = z.object({
  hotelId: z.uuid(),
  areaManagerUserId: z.uuid().optional(),
  positions: z.array(positionSchema).min(1).max(50),
})

export class CreateRequisitionDto extends createZodDto(createRequisitionSchema) {}
