import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/**
 * Corrección de Contabilidad sobre la vista previa de pago (Hugo, 2026-10-08):
 * tarifa y reparto de horas, los dos editables. El multiplicador de horas
 * extra NO se pide aquí — sigue resuelto del hotel/contrato en el servidor,
 * igual que en la corrida real.
 */
export const setPayOverrideSchema = z.object({
  regularMinutes: z.number().int().min(0),
  overtimeMinutes: z.number().int().min(0),
  payRate: z.number().positive(),
  reason: z.string().trim().min(4, 'El motivo debe explicar por qué se corrige').max(500),
})

export class SetPayOverrideDto extends createZodDto(setPayOverrideSchema) {}
