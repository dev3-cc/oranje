import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import type { Env } from '../../config/env.validation.js'

/**
 * El único punto de conexión a Postgres. Ningún módulo instancia su propio
 * PrismaClient: todos inyectan este servicio.
 *
 * Prisma 7 ya no abre la conexión por su cuenta — exige un *driver adapter*.
 * Aquí es `pg`, y por eso el pool se configura en este archivo y no en la URL.
 *
 * La conexión no apunta a la instancia de Cloud SQL: apunta al **Cloud SQL Auth
 * Proxy** en `localhost:5433` (Estándares de BD §13). En Cloud Run apunta al
 * socket unix `/cloudsql/...`, que es la misma URL con otro host.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),

      /**
       * Cloud SQL cuenta conexiones, no procesos: cada instancia del API abre
       * hasta `max`. Con autoescalado, `max × instancias` no puede pasar del
       * `max_connections` de la instancia.
       */
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
      connectionTimeoutMillis: config.get('DATABASE_CONNECT_TIMEOUT_MS', { infer: true }),

      /**
       * Ninguna consulta se queda colgada tomando un lugar del pool. Es el
       * techo de una consulta suelta, no de una transacción larga —esas están
       * prohibidas por Estándares de BD §10.
       */
      statement_timeout: config.get('DATABASE_STATEMENT_TIMEOUT_MS', { infer: true }),

      /**
       * Sale en `pg_stat_activity`. Sin esto, una consulta pesada en la consola
       * de Cloud SQL no dice de quién es.
       */
      application_name: 'oranje-api',
    })

    super({
      adapter,
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Conectado a Postgres')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  /**
   * Un ida y vuelta real a la base. Lo usa el health check: que el pool exista
   * no prueba que Postgres conteste.
   */
  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`
    return true
  }
}
