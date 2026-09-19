import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const updateProspectSchema = z
  .object({
    ownerUserId: z.uuid().optional(),
    needDescription: z.string().trim().min(1).max(2000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que cambiar' })

export class UpdateProspectDto extends createZodDto(updateProspectSchema) {}
