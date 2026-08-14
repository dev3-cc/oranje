import { createZodDto } from '../../../../common/pipes/index.js'

import { createHotelSchema } from './create-hotel.dto.js'

export const updateHotelSchema = createHotelSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'no hay nada que actualizar' })

export class UpdateHotelDto extends createZodDto(updateHotelSchema) {}
