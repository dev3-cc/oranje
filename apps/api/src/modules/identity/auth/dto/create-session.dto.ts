import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createSessionSchema = z.object({
  /** El ID token que devuelve el SDK de Firebase tras el login. */
  idToken: z.string().min(1),
})

export class CreateSessionDto extends createZodDto(createSessionSchema) {}
