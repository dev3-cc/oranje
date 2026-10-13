import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

const isMonday = (iso: string): boolean => new Date(`${iso}T00:00:00Z`).getUTCDay() === 1

// Todo opcional: sin parámetros, el listado es el de siempre (con su tope).
// El alcance (hotel propio o todos) lo decide el permiso, no este DTO: un
// `hotelId` aquí solo ACOTA lo que el permiso ya deja ver.
export const listTimesheetsSchema = z.object({
  status: z.string().trim().min(1).max(40).optional(),
  weekStart: z.iso
    .date()
    .refine(isMonday, { message: 'Debe ser un lunes en formato AAAA-MM-DD' })
    .optional(),
  hotelId: z.uuid().optional(),
})

export class ListTimesheetsDto extends createZodDto(listTimesheetsSchema) {}
