import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

import type { Env } from '../../config/env.validation.js'

/** El único punto de conexión a Postgres. Ningún módulo instancia su propio cliente. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService<Env, true>) {
    // Prisma 7 exige un driver adapter, y por eso el pool se configura aquí y
    // no como parámetros del DATABASE_URL
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: config.get('DATABASE_POOL_MAX', { infer: true }),
      connectionTimeoutMillis: config.get('DATABASE_CONNECT_TIMEOUT_MS', { infer: true }),
      statement_timeout: config.get('DATABASE_STATEMENT_TIMEOUT_MS', { infer: true }),
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

  /** Ida y vuelta real a la base: que el pool exista no prueba que Postgres conteste. */
  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`
    return true
  }
}
