import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createScheduleSchema = z.object({
  hotelId: z.uuid(),
  weekStart: z.coerce.date(),
})

export class CreateScheduleDto extends createZodDto(createScheduleSchema) {}
