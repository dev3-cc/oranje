import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ALLOW_OVERDUE } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { AccessDeadlineService } from './access-deadline.service.js'

const WORKER_ROLE = 'ROL-C-01'

// Vencidos los 3 dias para cambiar la contraseña temporal o para completar el
// expediente validado a medias, se bloquea el ACCESO hasta hacerlo. Lo que
// levanta el bloqueo (la ficha, cambiar la contraseña, completar el alta) va
// con @AllowWhenOverdue, el mismo escape que el plazo fiscal.
@Injectable()
export class AccessDeadlineGuard implements CanActivate {
  constructor(
    private readonly deadline: AccessDeadlineService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(ALLOW_OVERDUE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    if (!user || user.roleCode !== WORKER_ROLE) {
      return true
    }

    const overdue = await this.deadline.overdueOf(user.id)

    if (overdue.includes('PASSWORD')) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_OVERDUE',
        message:
          'Pasaron los 3 días para cambiar tu contraseña temporal: cámbiala desde Mis datos para seguir',
      })
    }

    if (overdue.includes('PROFILE')) {
      throw new ForbiddenException({
        code: 'PROFILE_OVERDUE',
        message:
          'Pasaron los 3 días para completar tus datos: complétalos desde Mis datos para seguir',
      })
    }

    return true
  }
}
