import { z } from 'zod'

/**
 * Estándares de Desarrollo §9: toda variable de entorno se declara y valida
 * al arranque. Si falta una, la app NO levanta — falla en el arranque, no a
 * media operación.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /**
   * Apunta al Cloud SQL Auth Proxy en `localhost:5433`, nunca a la IP de la
   * instancia (Estándares de BD §13). En Cloud Run es el socket unix
   * `/cloudsql/oranjeapp-gcp:us-central1:oranje`.
   */
  DATABASE_URL: z.string().url(),

  /**
   * Conexiones por instancia del API. `max × instancias` no puede pasar del
   * `max_connections` de Cloud SQL, que en la instancia `oranje` es 100.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  /** Cuánto espera por un lugar del pool antes de fallar. */
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  /** Techo de una consulta suelta. Ninguna se queda colgada ocupando el pool. */
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

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
