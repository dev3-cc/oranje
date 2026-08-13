import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Configuración de Prisma 7. La URL de conexión salió del schema y vive aquí.
 *
 * Usa MIGRATE_DATABASE_URL a propósito: las migraciones y el seed corren como
 * `oranje_dev`, que es dueño de los esquemas y las tablas. La aplicación se
 * conecta con `DATABASE_URL` como `app_user`, que solo tiene DML — y ni UPDATE
 * ni DELETE sobre el journal (RR-16).
 */

/**
 * `prisma generate` NO se conecta a nada, pero Prisma evalúa la URL al cargar
 * la configuración. Con el helper `env()` eso hace fallar cualquier
 * `pnpm install` sin `.env` —el CI, el build de la imagen, un clon recién
 * hecho— por una variable que ese comando no iba a usar.
 *
 * El marcador solo sobrevive hasta que algo intente conectarse: `migrate` y
 * `seed` fallan de inmediato contra un host que no existe, y el mensaje dice
 * cuál es la variable que falta.
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
