import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { z } from 'zod'

import { CONTACT_ATTEMPT_OUTCOMES, CONTACT_ATTEMPT_TYPES } from '@/shared/constants/contactAttempt'

/**
 * Validación del formulario de intento de contacto.
 *
 * §4 fija React Hook Form + Zod para formularios, y §5 dice que este mismo
 * schema tiene que ser el DTO del backend, definido UNA vez en
 * `packages/contracts`. Vive aquí porque ese paquete está fuera del alcance
 * acordado; al migrarlo, el pipe de Nest valida con este objeto y no con una
 * copia que se desincronice.
 *
 * Es una función y no una constante porque el mensaje de `occurredAt` se
 * resuelve al armarlo con el `i18n` del componente (D-36): quien lo usa lo
 * rearma cuando cambia el idioma.
 */
export function buildRegisterContactAttemptSchema(i18n: I18n) {
  return z.object({
    attemptType: z.enum(CONTACT_ATTEMPT_TYPES),
    /** Cadena vacía = no se encontró a nadie: `hotel_contact_id` es opcional. */
    hotelContactId: z.string(),
    outcome: z.enum(CONTACT_ATTEMPT_OUTCOMES),
    /** Formato de `<input type="datetime-local">`: `2026-06-18T11:30`. */
    occurredAt: z.string().min(1, i18n._(msg`Falta la fecha y hora del intento`)),
    notes: z.string(),
  })
}

export type RegisterContactAttemptForm = z.infer<
  ReturnType<typeof buildRegisterContactAttemptSchema>
>
