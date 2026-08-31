import { z } from 'zod'

/**
 * Validación del formulario de login. Deliberadamente laxa en la contraseña:
 * las reglas de fuerza son del alta de usuarios, no del login — aquí solo se
 * evita el viaje vacío.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo')
    .email('Escribe un correo válido, como ana@oranje.mx'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
