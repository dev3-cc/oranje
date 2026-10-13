import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'
import { PAYMENT_SLOTS } from '../payment-runs.service.js'

export const paymentRunSchema = z.object({
  /** Lunes de la semana cerrada, `AAAA-MM-DD`. */
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(PAYMENT_SLOTS),
  /** Solo ese hotel. Sin él, todos los que tengan horas aprobadas esa semana. */
  hotelId: z.uuid().optional(),
})

export class PaymentRunDto extends createZodDto(paymentRunSchema) {}
