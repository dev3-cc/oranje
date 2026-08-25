import { z } from 'zod'

// El interruptor es APP_ENV y no NODE_ENV: Jest pone NODE_ENV=test por su
// cuenta, y correr los tests no debe exigir material criptográfico.

export const APP_ENVS = ['local', 'staging', 'production'] as const
export type AppEnv = (typeof APP_ENVS)[number]

const baseSchema = z.object({
  APP_ENV: z.enum(APP_ENVS).default('local'),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // El proxy, nunca la IP de la instancia.
  DATABASE_URL: z.string().url(),

  // max × instancias <= max_connections de Cloud SQL.
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // Sin estas, solo /auth/session responde 503. Obligatorias en producción.
  AUTH_ISSUER_URL: optionalVar(z.string().url()),
  AUTH_AUDIENCE: optionalVar(z.string().min(1)),

  // Solo en local: el refinamiento de abajo tumba el arranque si aparece
  // en un desplegado.
  AUTH_DISABLED: booleanFromEnv(false),
  AUTH_DEV_USER_EMAIL: optionalVar(z.string().email()),

  // HS256 en local, RS256 en los desplegados.
  JWT_SECRET: optionalVar(z.string().min(32)),
  JWT_PRIVATE_KEY: optionalVar(z.string().min(1)),
  JWT_PUBLIC_KEY: optionalVar(z.string().min(1)).refine(
    (v) => v === undefined || v.includes('PUBLIC KEY'),
    'no parece un PEM SPKI',
  ),

  JWT_ACCESS_TTL_S: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_S: z.coerce.number().int().positive().default(604_800),

  COOKIE_SECURE: booleanFromEnv(true),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),

  // Places. La del SERVIDOR resuelve la foto del hotel y no sale de aqui; la
  // del NAVEGADOR va dentro de la URL de media que consume el <img> del
  // front, y es publica por diseno (D-17). Sin ellas el hotel no tiene foto.
  GOOGLE_PLACES_API_KEY: optionalVar(z.string().min(1)),
  GOOGLE_MAPS_BROWSER_KEY: optionalVar(z.string().min(1)),

  STORAGE_BUCKET: z.string().min(1),
  // El consumidor de eventos y el push. Sin ellas el modulo arranca pero
  // responde 401 en /notifications/events y no manda ningun push.
  PUBSUB_AUDIENCE: optionalVar(z.string().min(1)),
  PUBSUB_SERVICE_ACCOUNT: optionalVar(z.string().email()),
  FIREBASE_PROJECT_ID: optionalVar(z.string().min(1)),
  // Solo fuera de Cloud Run: ahi la cuenta va adjunta y firma sola.
  STORAGE_SIGNER_SERVICE_ACCOUNT: optionalVar(z.string().min(1)),
  // Tambien solo en local, y solo si la maquina trabaja en varios proyectos de
  // GCP: dice a cual cobrarle la llamada. Va declarada aqui porque el esquema
  // descarta lo que no declara, y sin esta linea nunca llegaba al servicio.
  GOOGLE_CLOUD_QUOTA_PROJECT: optionalVar(z.string().min(1)),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

// `FOO=` es lo mismo que no declararla: si no, el error dice "formato" en vez
// de "falta esta variable".
function optionalVar<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional())
}

// "false" es una cadena con valor de verdad.
function booleanFromEnv(porDefecto: boolean) {
  return z
    .enum(['true', 'false'])
    .default(porDefecto ? 'true' : 'false')
    .transform((v) => v === 'true')
}

// Donde un despliegue mal configurado muere al arrancar en vez de quedar abierto.
const envSchema = baseSchema.superRefine((env, ctx) => {
  const isDeployed = env.APP_ENV !== 'local'
  const isProduction = env.APP_ENV === 'production'

  const missing = (path: string, message: string): void => {
    ctx.addIssue({ code: 'custom', path: [path], message })
  }

  if (isDeployed) {
    if (!env.JWT_PRIVATE_KEY) missing('JWT_PRIVATE_KEY', `obligatoria en ${env.APP_ENV} (RS256)`)
    if (!env.JWT_PUBLIC_KEY) missing('JWT_PUBLIC_KEY', `obligatoria en ${env.APP_ENV} (RS256)`)

    if (env.AUTH_DISABLED) {
      missing('AUTH_DISABLED', `no se admite en ${env.APP_ENV}: dejaría la API abierta`)
    }

    if (!env.COOKIE_SECURE) {
      missing('COOKIE_SECURE', `debe ser true en ${env.APP_ENV}: la cookie viaja por HTTPS`)
    }

    // El emulador no verifica firmas: en la nube, cualquiera sería cualquiera.
    if (env.AUTH_ISSUER_URL?.includes('localhost')) {
      missing('AUTH_ISSUER_URL', 'apunta al emulador de Firebase, que no verifica firmas')
    }
  }

  // Staging levanta sin Firebase ni dominio; producción no.
  if (isProduction) {
    if (env.CORS_ORIGINS.length === 0) {
      missing('CORS_ORIGINS', 'obligatoria en production: §6 pide lista blanca explícita')
    }

    if (!env.AUTH_ISSUER_URL) missing('AUTH_ISSUER_URL', 'obligatoria en production')
    if (!env.AUTH_AUDIENCE) missing('AUTH_AUDIENCE', 'obligatoria en production')
  }

  if (!isDeployed) {
    if (!env.JWT_SECRET) missing('JWT_SECRET', 'obligatoria en local (HS256)')

    if (env.AUTH_DISABLED && !env.AUTH_DEV_USER_EMAIL) {
      missing('AUTH_DEV_USER_EMAIL', 'con AUTH_DISABLED hay que decir como quién trabajas')
    }
  }
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw)

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(`Configuración de entorno inválida:\n${detail}`)
  }

  return parsed.data
}
