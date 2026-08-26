import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

import { ATTEMPT_TYPES, OUTCOMES } from './create-contact-attempt.dto.js'

/**
 * Corrección de un intento YA registrado. La bitácora sigue siendo bitácora:
 * solo su AUTOR corrige (lo verifica el servicio) y cada corrección deja
 * huella en el journal — se enmienda el dato, no se reescribe la historia.
 */
export const updateContactAttemptSchema = z
  .object({
    attemptType: z.enum(ATTEMPT_TYPES).optional(),
    outcome: z.enum(OUTCOMES).optional(),
    /** `null` explícito = quitar el contacto asociado. */
    hotelContactId: z.uuid().nullable().optional(),
    occurredAt: z.coerce.date().optional(),
    notes: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'no hay nada que corregir' })

export class UpdateContactAttemptDto extends createZodDto(updateContactAttemptSchema) {}
