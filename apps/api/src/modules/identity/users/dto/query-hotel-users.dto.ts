import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

import { HOTEL_ROLES } from './create-hotel-user.dto.js'

/** El directorio de cuentas del hotel que administra el Administrador: todos los hoteles a la vez. */
export const queryHotelUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Busca en nombre, correo y nombre del hotel. */
  search: z.string().trim().min(1).max(120).optional(),
  roleCode: z.enum(HOTEL_ROLES).optional(),
  hotelId: z.uuid().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export class QueryHotelUsersDto extends createZodDto(queryHotelUsersSchema) {}
