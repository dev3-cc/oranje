import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const HOTEL_ROLES = ['ROL-H-01', 'ROL-H-02', 'ROL-H-03'] as const
export const GENERAL_MANAGER = 'ROL-H-03'

export const createHotelUserSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
  fullName: z.string().trim().min(1).max(160),
  roleCode: z.enum(HOTEL_ROLES),
  departmentId: z.uuid().optional(),
  reportsToUserId: z.uuid().optional(),
  /**
   * Su invitación sale en este idioma (D-36), y con él abre la app.
   *
   * Nace en **inglés**, al revés que el personal interno (Hugo, 2026-09-28):
   * estas cuentas son del **hotel cliente**, y los hoteles están en Georgia.
   * Nacer en español dejaba a 38 Managers Generales recibiendo correos que no
   * leen. Se puede cambiar en el alta; lo que cambia es de qué lado empieza.
   */
  locale: z.enum(['es', 'en']).optional().default('en'),
})

export class CreateHotelUserDto extends createZodDto(createHotelUserSchema) {}
