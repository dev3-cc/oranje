import { z } from 'zod'

/**
 * La resolución de una autorización: un solo campo.
 *
 * El motivo se declara opcional en el esquema porque su obligatoriedad NO
 * depende del campo sino de qué botón se pulsó —obligatorio al rechazar,
 * opcional al autorizar—, y eso no cabe en una validación de forma. La regla
 * vive en el manejador de rechazo, que es donde se conoce la intención.
 */
export const resolveAuthorizationSchema = z.object({
  reasonId: z.string(),
})

export type ResolveAuthorizationForm = z.infer<typeof resolveAuthorizationSchema>
