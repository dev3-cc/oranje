import { z } from 'zod'

/**
 * Estándares de Desarrollo §9: toda variable de entorno se declara y valida
 * al arranque. Si falta una, la app NO levanta — falla en el arranque, no a
 * media operación.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Apunta al Cloud SQL Auth Proxy, nunca a la IP de la instancia (BD §13)
  DATABASE_URL: z.string().url(),

  // Conexiones por instancia: max × instancias <= max_connections de Cloud SQL
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Firebase: emisor y audiencia del ID token que llega en el login.
  // En local es el emulador (http://localhost:9099); en la nube,
  // https://securetoken.google.com/<project-id>
  AUTH_ISSUER_URL: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),

  // Nuestro token, el que protege los CRUD. Firebase dice quién eres; este dice
  // qué puedes hacer. En producción sale de Secret Manager (D-07)
  JWT_SECRET: z.string().min(32, 'mínimo 32 caracteres'),
  JWT_ACCESS_TTL_S: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_S: z.coerce.number().int().positive().default(604_800),

  // La cookie del refresh viaja solo por HTTPS fuera de local
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

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
