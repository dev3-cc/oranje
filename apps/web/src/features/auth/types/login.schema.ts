import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { z } from 'zod'

/**
 * Validación del formulario de login. Deliberadamente laxa en la contraseña:
 * las reglas de fuerza son del alta de usuarios, no del login — aquí solo se
 * evita el viaje vacío.
 *
 * Los mensajes se resuelven al armar el esquema, así que recibe `i18n` y la
 * pantalla lo rearma al cambiar de idioma (D-36).
 */
export function buildLoginSchema(i18n: I18n) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, i18n._(msg`Escribe tu correo`))
      .email(i18n._(msg`Escribe un correo válido, como ana@oranje.mx`)),
    password: z.string().min(1, i18n._(msg`Escribe tu contraseña`)),
  })
}

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>
