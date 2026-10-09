import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/**
 * `payConceptId` ausente = ajuste del rate llano de la posición; con valor =
 * el gasto de ese concepto (Uber…), del catálogo del Administrador. Las dos
 * formas comparten `amount` + `reason`: Reclutamiento siempre dice cuánto y
 * por qué, nunca se asume.
 */
export const createPayAdjustmentSchema = z.object({
  payConceptId: z.string().uuid().optional(),
  amount: z.number().positive(),
  reason: z.string().trim().min(4).max(500),
})

export class CreatePayAdjustmentDto extends createZodDto(createPayAdjustmentSchema) {}
