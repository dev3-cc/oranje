import { Controller, Get } from '@nestjs/common'

import { PrismaService } from '../prisma/index.js'

/**
 * `GET /api/v1/health` es la primera prueba de que la conexión funciona, y
 * después el probe de Cloud Run.
 *
 * Dos rutas a propósito:
 *   /health      la app respondió. NO toca la base
 *   /health/db   la base contestó de verdad
 *
 * Si el probe de liveness pegara a la base, una caída de Postgres reiniciaría
 * el API en ciclo sin arreglar nada.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): { status: string } {
    return { status: 'ok' }
  }

  @Get('db')
  async checkDb(): Promise<{ status: string; database: string; latencyMs: number }> {
    const startedAt = process.hrtime.bigint()

    try {
      await this.prisma.ping()
    } catch {
      return { status: 'error', database: 'unreachable', latencyMs: -1 }
    }

    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    return { status: 'ok', database: 'reachable', latencyMs: Math.round(latencyMs) }
  }
}
