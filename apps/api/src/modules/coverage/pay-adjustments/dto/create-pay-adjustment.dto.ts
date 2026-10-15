import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/** Solo tiene sentido en el GASTO (con `payConceptId`): quién lo pagó decide
    qué hace Contabilidad con el pago del colaborador (Hugo, 2026-10-09). */
export const settlementEffects = ['REIMBURSE', 'COMPANY_EXPENSE', 'PAYROLL_DEDUCTION'] as const
export const settlementEffectSchema = z.enum(settlementEffects)

/**
 * `payConceptId` ausente = ajuste del rate llano de la posición; con valor =
 * el gasto de ese concepto (Uber…), del catálogo del Administrador. Las dos
 * formas comparten `amount` + `reason`: Reclutamiento siempre dice cuánto y
 * por qué, nunca se asume. `settlementEffect` solo acompaña al gasto: el
 * ajuste de tarifa no tiene de quién reembolsar o descontar.
 */
export const createPayAdjustmentSchema = z
  .object({
    payConceptId: z.string().uuid().optional(),
    amount: z.number().positive(),
    reason: z.string().trim().min(4).max(500),
    settlementEffect: settlementEffectSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.payConceptId && !value.settlementEffect) {
      ctx.addIssue({
        code: 'custom',
        path: ['settlementEffect'],
        message: 'Falta decir quién pagó el gasto',
      })
    }
    if (!value.payConceptId && value.settlementEffect) {
      ctx.addIssue({
        code: 'custom',
        path: ['settlementEffect'],
        message: 'El ajuste de tarifa no lleva quién pagó: eso es solo del gasto',
      })
    }
  })

export class CreatePayAdjustmentDto extends createZodDto(createPayAdjustmentSchema) {}
