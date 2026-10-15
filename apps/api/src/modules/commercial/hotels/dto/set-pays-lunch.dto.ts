import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const setPaysLunchSchema = z.object({
  paysLunch: z.boolean(),
})

export class SetPaysLunchDto extends createZodDto(setPaysLunchSchema) {}
