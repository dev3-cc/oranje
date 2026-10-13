import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/** `dayStatusId: null` quita el estado — el día vuelve a "sin marcar". El día
    puede no existir todavía (sin ponches no tiene fila): por eso viaja como
    fecha y no como id de un `timesheet_day`. */
export const setDayStatusSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayStatusId: z.string().uuid().nullable(),
})

export class SetDayStatusDto extends createZodDto(setDayStatusSchema) {}
