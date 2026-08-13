import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

import { AccessTokenService } from './access-token.service.js'
import { FirebaseTokenService } from './firebase-token.service.js'
import { RefreshTokenRepository } from './refresh-token.repository.js'

export interface Session {
  accessToken: string
  expiresIn: number
  refreshToken: string
  user: { id: string; email: string; fullName: string; roleCode: string }
}

interface UserForSession {
  id: string
  email: string
  fullName: string
  hotelId: string | null
  departmentId: string | null
  isActive: boolean
  role: { code: string }
}

const USER_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  hotelId: true,
  departmentId: true,
  isActive: true,
  role: { select: { code: true } },
} as const

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseTokenService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  /** Crear sesión: entra el ID token de Firebase, sale el nuestro. */
  async createSession(idToken: string, userAgent: string | null): Promise<Session> {
    const identity = await this.firebase.verify(idToken)

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: identity.uid },
      select: USER_FIELDS,
    })

    // Existir en Firebase no basta: hay que estar dado de alta en Oranje con un
    // rol. Sin fila aquí, el token es el de un desconocido
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_REGISTERED',
        message: 'La cuenta no está dada de alta en Oranje',
      })
    }

    this.assertActive(user)

    const { session } = await this.emit(user, userAgent)

    return session
  }

  /**
   * Rotación: cada refresh quema el anterior. Si llega uno ya reemplazado o
   * revocado, alguien más tiene una copia — se cierran TODAS las sesiones del
   * usuario, no solo la que llegó.
   */
  async refresh(token: string, userAgent: string | null): Promise<Session> {
    const stored = await this.refreshTokens.find(token)

    if (!stored) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Sesión no válida' })
    }

    if (stored.replacedById !== null || stored.revokedAt !== null) {
      await this.refreshTokens.revokeAllOf(stored.userId)
      this.logger.warn(`Reuso de refresh token: sesiones cerradas para ${stored.userId}`)

      throw new UnauthorizedException({
        code: 'REFRESH_REUSED',
        message: 'La sesión se cerró por seguridad',
      })
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({ code: 'REFRESH_EXPIRED', message: 'La sesión expiró' })
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: USER_FIELDS,
    })

    if (!user) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Sesión no válida' })
    }

    if (!user.isActive) {
      await this.refreshTokens.revokeAllOf(user.id)
      this.assertActive(user)
    }

    const { session, refreshTokenId } = await this.emit(user, userAgent)
    await this.refreshTokens.revoke(stored.id, refreshTokenId)

    return session
  }

  /** Matar la sesión actual. */
  async logout(token: string): Promise<void> {
    const stored = await this.refreshTokens.find(token)

    // Si no existe o ya estaba revocado, para el cliente el resultado es el
    // mismo. No se distingue, para no filtrar qué tokens existen
    if (stored && stored.revokedAt === null) {
      await this.refreshTokens.revoke(stored.id)
    }
  }

  /** Matar todas las sesiones del usuario. */
  async logoutAll(userId: string): Promise<number> {
    return this.refreshTokens.revokeAllOf(userId)
  }

  private assertActive(user: UserForSession): void {
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'La cuenta está desactivada',
      })
    }
  }

  private async emit(
    user: UserForSession,
    userAgent: string | null,
  ): Promise<{ session: Session; refreshTokenId: string }> {
    const { token: accessToken, expiresIn } = await this.accessTokens.sign({
      sub: user.id,
      roleCode: user.role.code,
      hotelId: user.hotelId,
      departmentId: user.departmentId,
    })

    const refresh = await this.refreshTokens.issue(user.id, userAgent)

    return {
      session: {
        accessToken,
        expiresIn,
        refreshToken: refresh.token,
        user: { id: user.id, email: user.email, fullName: user.fullName, roleCode: user.role.code },
      },
      refreshTokenId: refresh.id,
    }
  }
}
