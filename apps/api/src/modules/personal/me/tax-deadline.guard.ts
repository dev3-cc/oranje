import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { TaxDeadlineService } from './tax-deadline.service.js'

const WORKER_ROLE = 'ROL-C-01'
const CACHE_TTL_MS = 60_000

// Dia 5 sin SSN/ITIN cargado: se suspende el ACCESO, no los datos (Reglas del
// Colaborador). El desbloqueo lo hace Oranje tras verificar, asi que no hay
// endpoint que lo levante: se levanta solo al subir el documento.
//
// Solo mira a los colaboradores; para cualquier otro rol sale en la primera
// linea sin tocar la base.
@Injectable()
export class TaxDeadlineGuard implements CanActivate {
  private readonly cache = new Map<string, { suspended: boolean; expiresAt: number }>()

  constructor(private readonly deadline: TaxDeadlineService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user

    if (!user || user.roleCode !== WORKER_ROLE) {
      return true
    }

    if (await this.suspended(user.id)) {
      throw new ForbiddenException({
        code: 'TAX_ID_OVERDUE',
        message:
          'Tu acceso está suspendido: pasaron los 3 días para cargar tu SSN o ITIN. Contacta a Oranje',
      })
    }

    return true
  }

  private async suspended(userId: string): Promise<boolean> {
    const cached = this.cache.get(userId)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.suspended
    }

    const suspended = await this.deadline.isSuspended(userId)

    this.cache.set(userId, { suspended, expiresAt: Date.now() + CACHE_TTL_MS })

    return suspended
  }
}
