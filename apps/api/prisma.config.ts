import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Configuración de Prisma 7. Usa MIGRATE_DATABASE_URL porque migraciones y seed
 * corren como dueño de los esquemas; la app se conecta con DATABASE_URL como
 * `app_user`, que solo tiene DML y ni UPDATE ni DELETE sobre el journal (RR-16).
 */

/**
 * Marcador para que `prisma generate` no exija la variable: no se conecta a
 * nada, pero Prisma evalúa la URL al cargar la config, y con `env()` cualquier
 * `pnpm install` sin `.env` fallaría. Solo sobrevive hasta que algo se conecte.
 */
const SIN_CONFIGURAR = 'postgresql://falta:MIGRATE_DATABASE_URL@no-configurado:5432/oranje'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // El migrador, no la app: crear tablas es DDL y app_user no lo tiene.
    url: process.env['MIGRATE_DATABASE_URL'] ?? SIN_CONFIGURAR,
  },
})
