import { Injectable, Logger } from '@nestjs/common'

import { PrismaService } from '../prisma/index.js'

/** Lo que se puede ajustar sin desplegar. La lista es cerrada a propósito. */
export const SETTING_KEYS = {
  mailTransport: 'mail.transport',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

/**
 * Cuánto vive el valor en memoria.
 *
 * Es la única cifra que de verdad importa aquí: marca cuánto tarda en surtir
 * efecto mover el interruptor. Un minuto es el trato — lo bastante corto para
 * que sirva de freno de mano en una urgencia, y lo bastante largo para no
 * consultar la base en cada correo.
 */
const CACHE_MS = 60_000

interface Cached {
  value: string | null
  readAt: number
}

/**
 * Los ajustes del sistema, leídos con caché corta.
 *
 * **Nunca lanza al leer.** Si la base no responde, devuelve el valor por
 * defecto que le pase quien pregunta: un ajuste caído no puede dejar sin
 * correo a nadie, que es justo lo contrario de para lo que existe.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)
  private readonly cache = new Map<string, Cached>()

  constructor(private readonly prisma: PrismaService) {}

  async get(key: SettingKey, fallback: string): Promise<string> {
    const hit = this.cache.get(key)

    if (hit !== undefined && Date.now() - hit.readAt < CACHE_MS) {
      return hit.value ?? fallback
    }

    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key } })

      this.cache.set(key, { value: row?.value ?? null, readAt: Date.now() })

      return row?.value ?? fallback
    } catch (error) {
      this.logger.error(`No se pudo leer el ajuste ${key}: ${messageOf(error)}`)

      /* Se cachea el fallo también: si la base está mal, insistir en cada
         correo la castiga más. */
      this.cache.set(key, { value: hit?.value ?? null, readAt: Date.now() })

      return hit?.value ?? fallback
    }
  }

  /** Escribe y olvida la caché DE ESTA INSTANCIA. Ver la nota de abajo. */
  async set(key: SettingKey, value: string, actorUserId: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: actorUserId },
      update: { value, updatedBy: actorUserId, updatedAt: new Date() },
    })

    this.cache.delete(key)
  }

  async readAll(): Promise<Array<{ key: string; value: string; updatedAt: Date }>> {
    return this.prisma.appSetting.findMany({
      select: { key: true, value: true, updatedAt: true },
      orderBy: { key: 'asc' },
    })
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
