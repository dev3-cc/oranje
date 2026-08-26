import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/**
 * El correo NO se edita: es el vínculo con la cuenta de Firebase. Cambiar de
 * persona es dar de baja (`isActive: false`) y dar de alta a la nueva.
 * `.strict()` para que un `email` en el PATCH sea un 400 explícito y no un
 * campo ignorado en silencio.
 */
export const updateStaffUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160).optional(),
    roleCode: z.string().trim().toUpperCase().min(1).max(20).optional(),
    /** `null` explícito = ya no reporta a nadie. */
    reportsToUserId: z.uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'no hay nada que actualizar' })

export class UpdateStaffUserDto extends createZodDto(updateStaffUserSchema) {}
