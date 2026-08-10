import { Controller, Get } from '@nestjs/common'

import { PrismaService } from '../prisma/index.js'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness. No toca la base a propósito: si lo hiciera, una caída de Postgres
  // reiniciaría el API en ciclo sin arreglar nada
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
