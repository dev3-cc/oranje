import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const createHotelContactSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160),
    jobTitle: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(7).max(32).optional(),
    email: z.email().max(160).optional(),
    isPrimary: z.boolean().default(false),
  })
  .refine((v) => v.phone !== undefined || v.email !== undefined, {
    path: ['phone'],
    message: 'hace falta el teléfono o el correo',
  })

export class CreateHotelContactDto extends createZodDto(createHotelContactSchema) {}
