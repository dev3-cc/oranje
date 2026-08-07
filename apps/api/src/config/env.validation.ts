import { z } from 'zod'

/**
 * Estándares de Desarrollo §9: toda variable de entorno se declara y valida
 * al arranque. Si falta una, la app NO levanta — falla en el arranque, no a
 * media operación.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  AUTH_ISSUER_URL: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),

  STORAGE_BUCKET: z.string().min(1),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw)

  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Configuración de entorno inválida:\n${detalle}`)
  }

  return parsed.data
}
