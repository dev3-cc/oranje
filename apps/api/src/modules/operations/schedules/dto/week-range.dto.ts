import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

// El rango lo elige el cliente. Sin tope, una app podria pedir el historial
// entero de un colaborador en una sola llamada.
export const weekRangeSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.to >= v.from, { message: '`to` no puede ser anterior a `from`' })
  .refine((v) => (v.to.getTime() - v.from.getTime()) / 86_400_000 <= 92, {
    message: 'El rango no puede pasar de 92 días',
  })

export class WeekRangeDto extends createZodDto(weekRangeSchema) {}
