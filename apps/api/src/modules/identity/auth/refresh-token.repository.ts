import { createHash, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v7 as uuidv7 } from 'uuid'

import type { Env } from '../../../config/env.validation.js'
import { PrismaService } from '../../../infra/prisma/index.js'

export interface RefreshTokenRow {
  id: string
  userId: string
  expiresAt: Date
  revokedAt: Date | null
  replacedById: string | null
}

/** Del token en claro nunca se guarda nada: solo su SHA-256. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class RefreshTokenRepository {
  private readonly ttlSeconds: number

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('JWT_REFRESH_TTL_S', { infer: true })
  }

  async issue(
    userId: string,
    userAgent: string | null,
  ): Promise<{ token: string; id: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url')
    const id = uuidv7()
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000)

    await this.prisma.refreshToken.create({
      data: { id, userId, tokenHash: hash(token), expiresAt, userAgent },
    })

    return { token, id, expiresAt }
  }

  async find(token: string): Promise<RefreshTokenRow | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash(token) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true, replacedById: true },
    })
  }

  async revoke(id: string, replacedById: string | null = null): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById },
    })
  }

  /** Cierra todas las sesiones vivas de un usuario. */
  async revokeAllOf(userId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    return count
  }
}
