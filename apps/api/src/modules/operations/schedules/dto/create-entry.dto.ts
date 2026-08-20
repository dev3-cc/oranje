import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const createEntrySchema = z.object({
  assignmentId: z.uuid(),
  workDate: z.coerce.date(),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
})

export class CreateEntryDto extends createZodDto(createEntrySchema) {}
