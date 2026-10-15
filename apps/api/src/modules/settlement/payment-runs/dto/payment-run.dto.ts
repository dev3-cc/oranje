import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'
import { PAYMENT_SLOTS } from '../payment-runs.service.js'

export const paymentRunSchema = z.object({
  /** Lunes de la semana cerrada, `AAAA-MM-DD`. */
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(PAYMENT_SLOTS),
  /** Obligatorio: una corrida es de UN hotel (Hugo, 2026-10-14 — "¿cómo vas
      a cerrar todos?"). Antes era opcional y sin él corría todos los
      hoteles con horas aprobadas de golpe; el front ya nunca lo manda así,
      pero el servidor lo seguía permitiendo — un script o un botón futuro
      podía disparar la bulk sin querer. Un programador que algún día corra
      esto para todo el portafolio itera hoteles y llama una vez por cada
      uno, igual que ya hace cualquier humano. */
  hotelId: z.uuid(),
})

export class PaymentRunDto extends createZodDto(paymentRunSchema) {}
