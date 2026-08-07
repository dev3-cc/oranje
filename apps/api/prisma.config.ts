import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Configuración de Prisma 7. La URL de conexión salió del schema y vive aquí.
 *
 * La variable se valida además con Zod al arranque de la app
 * (src/config/env.validation.ts): si falta, la app no levanta.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
