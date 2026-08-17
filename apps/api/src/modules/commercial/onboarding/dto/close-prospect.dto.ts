import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const closeProspectSchema = z.object({
  reasonCode: z.string().trim().min(1).max(60),
  note: z.string().trim().min(1).max(1000).optional(),
})

export class CloseProspectDto extends createZodDto(closeProspectSchema) {}
