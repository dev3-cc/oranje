import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Configuración de Prisma 7. La URL de conexión salió del schema y vive aquí.
 *
 * Usa MIGRATE_DATABASE_URL a propósito: las migraciones y el seed corren como
 * `oranje_dev`, que es dueño de los esquemas y las tablas. La aplicación se
 * conecta con `DATABASE_URL` como `app_user`, que solo tiene DML — y ni UPDATE
 * ni DELETE sobre el journal (RR-16).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // El migrador, no la app: crear tablas es DDL y app_user no lo tiene.
    url: env('MIGRATE_DATABASE_URL'),
  },
})
