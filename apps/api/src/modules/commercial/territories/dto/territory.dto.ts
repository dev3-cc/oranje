import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const setZonesSchema = z.object({
  zoneIds: z.array(z.uuid()).max(50),
})

export class SetZonesDto extends createZodDto(setZonesSchema) {}
