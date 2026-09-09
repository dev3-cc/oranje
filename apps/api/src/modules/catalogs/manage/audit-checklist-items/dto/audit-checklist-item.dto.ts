import { z } from 'zod'

import { createZodDto } from '../../../../../common/pipes/index.js'

const AUDIT_TYPES = ['PERSONAL_PRESENTATION', 'ENVIRONMENT'] as const

/**
 * Alta de un reactivo. `code` NO viaja: se deriva de `label`, igual que el
 * catálogo genérico deriva de `name` — el empate lo decide el único
 * `(auditType, code)` de la base, no un SELECT previo.
 *
 * `ordinal` sí es obligatorio aquí (a diferencia del genérico): la tabla no
 * tiene DEFAULT y es la posición DENTRO de su categoría, no global.
 */
export const createAuditChecklistItemSchema = z.object({
  auditType: z.enum(AUDIT_TYPES),
  category: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(300),
  weight: z.number().positive().max(999).optional(),
  ordinal: z.number().int().min(1),
})

export class CreateAuditChecklistItemDto extends createZodDto(createAuditChecklistItemSchema) {}

// `auditType` NO se corrige: cambiarlo rompería las respuestas ya guardadas,
// que llevan el tipo duplicado a propósito para su FK compuesta.
export const updateAuditChecklistItemSchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(300).optional(),
  weight: z.number().positive().max(999).optional(),
  ordinal: z.number().int().min(1).optional(),
})

export class UpdateAuditChecklistItemDto extends createZodDto(updateAuditChecklistItemSchema) {}
