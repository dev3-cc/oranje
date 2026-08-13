import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'

import { AuthenticatedUser, IS_PUBLIC } from '../../../../common/decorators/index.js'
import { AccessTokenService } from '../access-token.service.js'

/**
 * Guard global: ninguna ruta responde sin token salvo que lleve `@Public()`.
 *
 * Solo verifica la firma y cuelga el usuario del request. **No decide permisos**
 * — eso es de la Matriz (`identity.role_permission`) y va en un guard aparte.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
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

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization

    if (!header?.startsWith('Bearer ')) {
      return null
    }

    return header.slice('Bearer '.length).trim() || null
  }
}
