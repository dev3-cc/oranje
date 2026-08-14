import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const updateHotelContactSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160).optional(),
    jobTitle: z.string().trim().min(1).max(120).nullable().optional(),
    phone: z.string().trim().min(7).max(32).nullable().optional(),
    email: z.email().max(160).nullable().optional(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no hay nada que actualizar' })

export class UpdateHotelContactDto extends createZodDto(updateHotelContactSchema) {}
