import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/**
 * Ni el correo ni el rol ni el hotel se editan: el correo es el vínculo con
 * Firebase, y cambiar de rol o de hotel es otra cuenta (dar de baja y dar de
 * alta). `.strict()` para que un `email` en el PATCH sea un 400 explícito.
 */
export const updateHotelUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160).optional(),
    /** `null` solo lo acepta el Manager General (que nunca lleva departamento). */
    departmentId: z.uuid().nullable().optional(),
    /** `null` explícito = ya no reporta a nadie. */
    reportsToUserId: z.uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'no hay nada que actualizar' })

export class UpdateHotelUserDto extends createZodDto(updateHotelUserSchema) {}
