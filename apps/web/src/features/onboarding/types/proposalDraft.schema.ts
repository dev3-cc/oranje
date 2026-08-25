import { z } from 'zod'

/**
 * Validación del borrador de propuesta (§4: React Hook Form + Zod).
 *
 * La regla del margen es de NEGOCIO, no de formato: si se factura por debajo de
 * lo que se paga, cada hora trabajada cuesta dinero. Se valida en el borrador
 * para que no llegue a enviarse, y el mismo objeto debe validar en el pipe de
 * Nest cuando migre a `packages/contracts` — si solo lo valida el front, basta
 * un `curl` para saltárselo.
 */
export const proposalDraftSchema = z
  .object({
    servicesNote: z.string().trim().min(1, 'Describe los servicios ofrecidos'),
    payRate: z.number().positive('El pay rate debe ser mayor que cero'),
    billRate: z.number().positive('El bill rate debe ser mayor que cero'),
  })
  .refine((values) => values.billRate > values.payRate, {
    path: ['billRate'],
    message: 'El bill rate tiene que ser mayor que el pay rate: si no, se pierde en cada hora.',
  })

export type ProposalDraftForm = z.infer<typeof proposalDraftSchema>
