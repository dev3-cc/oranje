import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import type { AuthenticatedUser } from '../../../../common/decorators/index.js'
import { PermisoRequerido, REQUIERE_PERMISO } from '../../../../common/decorators/index.js'
import { PermissionsService } from '../permissions.service.js'

// Una ruta sin @Requires pasa: exigirlo en todas obligaría a inventar un
// permiso por endpoint auxiliar.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermisoRequerido>(REQUIERE_PERMISO, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    // Sin usuario aquí solo se llega si la ruta es @Public() y pide permiso a la
    // vez. Es una contradicción del código, no del usuario
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Esta acción requiere una sesión',
      })
    }

    const puede = await this.permissions.can(user.roleCode, required.module, required.action)

    if (!puede) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Tu rol no puede ${required.action} en ${required.module}`,
      })
    }

    return true
  }
}
