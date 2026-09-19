import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createProspectSchema = z.object({
  hotelId: z.uuid(),
  ownerUserId: z.uuid().optional(),
  needDescription: z.string().trim().min(1).max(1000).optional(),
})

export class CreateProspectDto extends createZodDto(createProspectSchema) {}
