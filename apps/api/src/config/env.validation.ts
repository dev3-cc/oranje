import { z } from 'zod'

/**
 * Estándares de Desarrollo §9: toda variable se valida al arranque, así que si
 * falta una la app no levanta.
 *
 * El interruptor es APP_ENV y no NODE_ENV porque Jest pone NODE_ENV=test por su
 * cuenta, y correr los tests no debe exigir material criptográfico.
 */

/** local: tu máquina · staging: oranje-staging · production: oranje-prod (D-06). */
export const APP_ENVS = ['local', 'staging', 'production'] as const
export type AppEnv = (typeof APP_ENVS)[number]

const baseSchema = z.object({
  APP_ENV: z.enum(APP_ENVS).default('local'),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Apunta al Cloud SQL Auth Proxy, nunca a la IP de la instancia (BD §13)
  DATABASE_URL: z.string().url(),

  // Conexiones por instancia: max × instancias <= max_connections de Cloud SQL
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  /**
   * Firebase: emisor y audiencia del ID token del login. Opcionales mientras no
   * exista el proyecto — sin ellas solo `/auth/session` responde 503.
   * Obligatorias en producción.
   */
  AUTH_ISSUER_URL: opcional(z.string().url()),
  AUTH_AUDIENCE: opcional(z.string().min(1)),

  /**
   * Apaga la autenticación y trabaja como AUTH_DEV_USER_EMAIL. Solo en `local`:
   * el refinamiento de abajo tumba el arranque si aparece en un desplegado.
   */
  AUTH_DISABLED: booleanFromEnv(false),
  AUTH_DEV_USER_EMAIL: opcional(z.string().email()),

  // --- Nuestro JWT ---
  // local firma con secreto compartido (HS256); staging y producción con par
  // de llaves (RS256), para que la llave que firma no sea la que verifica
  JWT_SECRET: opcional(z.string().min(32)),
  JWT_PRIVATE_KEY: opcional(z.string().min(1)),
  JWT_PUBLIC_KEY: opcional(z.string().min(1)).refine(
    (v) => v === undefined || v.includes('PUBLIC KEY'),
    'no parece un PEM SPKI',
  ),

  JWT_ACCESS_TTL_S: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_S: z.coerce.number().int().positive().default(604_800),

  COOKIE_SECURE: booleanFromEnv(true),

  /** Lista blanca de orígenes, separados por coma. Vacío = ninguno. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  /** Peticiones por minuto y por IP. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),

  STORAGE_BUCKET: z.string().min(1),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

/**
 * `FOO=` es lo mismo que no declararla. Sin esto, dejar el hueco en el `.env` da
 * un error de formato en vez del de "falta esta variable", que es el útil.
 */
function opcional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional())
}

/** Las variables de entorno son strings; "false" es una cadena con valor de verdad. */
function booleanFromEnv(porDefecto: boolean) {
  return z
    .enum(['true', 'false'])
    .default(porDefecto ? 'true' : 'false')
    .transform((v) => v === 'true')
}

/**
 * Lo que exige cada ambiente: local afloja, los desplegados aprietan. Es donde
 * un despliegue mal configurado muere al arrancar en vez de quedar abierto.
 */
const envSchema = baseSchema.superRefine((env, ctx) => {
  const esDesplegado = env.APP_ENV !== 'local'
  const esProduccion = env.APP_ENV === 'production'

  const falta = (path: string, message: string): void => {
    ctx.addIssue({ code: 'custom', path: [path], message })
  }

  if (esDesplegado) {
    // Firma asimétrica: la llave que firma no sale del servicio que emite
    if (!env.JWT_PRIVATE_KEY) falta('JWT_PRIVATE_KEY', `obligatoria en ${env.APP_ENV} (RS256)`)
    if (!env.JWT_PUBLIC_KEY) falta('JWT_PUBLIC_KEY', `obligatoria en ${env.APP_ENV} (RS256)`)

    if (env.AUTH_DISABLED) {
      falta('AUTH_DISABLED', `no se admite en ${env.APP_ENV}: dejaría la API abierta`)
    }

    if (!env.COOKIE_SECURE) {
      falta('COOKIE_SECURE', `debe ser true en ${env.APP_ENV}: la cookie viaja por HTTPS`)
    }

    // El emulador no verifica firmas: en la nube, cualquiera sería cualquiera
    if (env.AUTH_ISSUER_URL?.includes('localhost')) {
      falta('AUTH_ISSUER_URL', 'apunta al emulador de Firebase, que no verifica firmas')
    }
  }

  // Staging levanta sin Firebase ni dominio, para probar los CRUD antes de que
  // existan. Producción no: ahí separan "desplegado" de "abierto".
  if (esProduccion) {
    if (env.CORS_ORIGINS.length === 0) {
      falta('CORS_ORIGINS', 'obligatoria en production: §6 pide lista blanca explícita')
    }

    if (!env.AUTH_ISSUER_URL) falta('AUTH_ISSUER_URL', 'obligatoria en production')
    if (!env.AUTH_AUDIENCE) falta('AUTH_AUDIENCE', 'obligatoria en production')
  }

  if (!esDesplegado) {
    if (!env.JWT_SECRET) falta('JWT_SECRET', 'obligatoria en local (HS256)')

    if (env.AUTH_DISABLED && !env.AUTH_DEV_USER_EMAIL) {
      falta('AUTH_DEV_USER_EMAIL', 'con AUTH_DISABLED hay que decir como quién trabajas')
    }
  }
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
