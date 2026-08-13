import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import type { AuthenticatedUser } from '../../../../common/decorators/index.js'
import { IS_PUBLIC } from '../../../../common/decorators/index.js'
import type { Env } from '../../../../config/env.validation.js'
import { PrismaService } from '../../../../infra/prisma/index.js'
import { AccessTokenService } from '../access-token.service.js'

/**
 * Guard global: ninguna ruta responde sin token salvo que lleve `@Public()`.
 *
 * Solo verifica la firma y cuelga el usuario del request. **No decide permisos**
 * — eso es de la Matriz (`identity.role_permission`) y va en un guard aparte.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name)
  private readonly authDisabled: boolean
  private readonly devUserEmail: string | undefined
  private devUser: AuthenticatedUser | null = null

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    // La validación de entorno ya impidió que esto sea true fuera de local
    this.authDisabled = config.get('AUTH_DISABLED', { infer: true })
    this.devUserEmail = config.get('AUTH_DEV_USER_EMAIL', { infer: true })

    if (this.authDisabled) {
      this.logger.warn(`AUTENTICACIÓN APAGADA — todo request es ${this.devUserEmail}`)
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()

    if (this.authDisabled) {
      request.user = await this.resolverUsuarioDeDesarrollo()

      return true
    }

    const token = this.extractToken(request)

    if (!token) {
      throw new UnauthorizedException({
        code: 'TOKEN_MISSING',
        message: 'Falta el token de acceso',
      })
    }

    const payload = await this.accessTokens.verify(token)

    request.user = {
      id: payload.sub,
      roleCode: payload.roleCode,
      hotelId: payload.hotelId,
      departmentId: payload.departmentId,
    }

    return true
  }

  /**
   * El usuario suplantado es uno real de la base, no uno inventado: así el
   * alcance y el rol con los que trabajas en local son los mismos que en la nube.
   */
  private async resolverUsuarioDeDesarrollo(): Promise<AuthenticatedUser> {
    if (this.devUser) {
      return this.devUser
    }

    // La validación de entorno ya lo exigió junto con AUTH_DISABLED
    const email = this.devUserEmail ?? ''

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        hotelId: true,
        departmentId: true,
        role: { select: { code: true } },
      },
    })

    if (!user) {
      throw new UnauthorizedException({
        code: 'DEV_USER_NOT_FOUND',
        message: `AUTH_DISABLED apunta a ${this.devUserEmail}, que no existe en identity.user`,
      })
    }

    this.devUser = {
      id: user.id,
      roleCode: user.role.code,
      hotelId: user.hotelId,
      departmentId: user.departmentId,
    }

    return this.devUser
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization

    if (!header?.startsWith('Bearer ')) {
      return null
    }

    return header.slice('Bearer '.length).trim() || null
  }
}
