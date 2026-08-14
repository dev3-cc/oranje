import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import type { AuthenticatedUser } from '../../../../common/decorators/index.js'
import { PermisoRequerido, REQUIERE_PERMISO } from '../../../../common/decorators/index.js'
import { PermissionsService } from '../permissions.service.js'

/**
 * Segundo guard global. Corre después del de identidad, así que ya hay usuario.
 *
 * Una ruta sin `@Requires()` pasa: exigir el decorador en todas obligaría a
 * inventar un permiso para cada endpoint auxiliar. Lo que protege el sistema es
 * que **la acción que importa sí lo lleve** — y el permiso no existe hasta que
 * alguien lo siembra desde la Matriz.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisos: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requerido = this.reflector.getAllAndOverride<PermisoRequerido>(REQUIERE_PERMISO, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requerido) {
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

    const puede = await this.permisos.can(user.roleCode, requerido.module, requerido.action)

    if (!puede) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Tu rol no puede ${requerido.action} en ${requerido.module}`,
      })
    }

    return true
  }
}
