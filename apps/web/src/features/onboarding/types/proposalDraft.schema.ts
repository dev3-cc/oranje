import { z } from 'zod'

/**
 * Validación del borrador de propuesta (§4: React Hook Form + Zod).
 *
 * La propuesta cotiza POR PUESTO: un renglón por posición del catálogo, con su
 * pay y su bill. La regla del margen es de NEGOCIO, no de formato: si se
 * factura por debajo de lo que se paga, cada hora trabajada cuesta dinero. Se
 * valida aquí para que no llegue a enviarse, y el API la vuelve a validar
 * (`RATE_MARGIN_NEGATIVE`) — si solo lo valida el front, basta un `curl` para
 * saltárselo.
 *
 * El margen SÍ puede ser cero: hay hoteles donde un puesto se cotiza al costo.
 * Lo que no puede es ser negativo.
 */
export const proposalRateSchema = z.object({
  positionId: z.string().min(1, 'Elige el puesto'),
  payRate: z.number().positive('El pay rate debe ser mayor que cero'),
  billRate: z.number().positive('El bill rate debe ser mayor que cero'),
})

export const proposalDraftSchema = z
  .object({
    servicesNote: z.string().trim().min(1, 'Describe los servicios ofrecidos'),
    rates: z.array(proposalRateSchema).min(1, 'Agrega al menos un puesto con su tarifa'),
  })
  .superRefine((values, ctx) => {
    values.rates.forEach((rate, index) => {
      if (rate.billRate < rate.payRate) {
        ctx.addIssue({
          code: 'custom',
          path: ['rates', index, 'billRate'],
          message: 'El bill rate no puede quedar por debajo del pay rate: se pierde en cada hora.',
        })
      }
    })

    const seen = new Map<string, number>()

    values.rates.forEach((rate, index) => {
      if (rate.positionId === '') return

      const first = seen.get(rate.positionId)

      if (first === undefined) {
        seen.set(rate.positionId, index)
        return
      }

      ctx.addIssue({
        code: 'custom',
        path: ['rates', index, 'positionId'],
        message: 'Este puesto ya tiene su tarifa más arriba',
      })
    })
  })

export type ProposalDraftForm = z.infer<typeof proposalDraftSchema>
