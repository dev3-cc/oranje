import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { ALLOW_OVERDUE } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { TaxDeadlineService } from './tax-deadline.service.js'

const WORKER_ROLE = 'ROL-C-01'

// Dia 5 sin SSN/ITIN cargado: se suspende el ACCESO, no los datos (Reglas del
// Colaborador). El desbloqueo lo hace Oranje tras verificar, asi que no hay
// endpoint que lo levante: se levanta solo al subir el documento.
//
// Solo mira a los colaboradores; para cualquier otro rol sale en la primera
// linea sin tocar la base.
@Injectable()
export class TaxDeadlineGuard implements CanActivate {
  constructor(
    private readonly deadline: TaxDeadlineService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Lo que levanta la suspensión no puede quedar detrás de la suspensión.
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

    if (await this.deadline.isSuspended(user.id)) {
      throw new ForbiddenException({
        code: 'TAX_ID_OVERDUE',
        message:
          'Tu acceso está suspendido: pasaron los 3 días para cargar tu SSN o ITIN. Contacta a Oranje',
      })
    }

    return true
  }
}
