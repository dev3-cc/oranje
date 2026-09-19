import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createSessionSchema = z.object({
  idToken: z.string().min(1),
})

export class CreateSessionDto extends createZodDto(createSessionSchema) {}
