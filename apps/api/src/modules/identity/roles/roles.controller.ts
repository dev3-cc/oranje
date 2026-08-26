import { Controller, Get } from '@nestjs/common'

import { Requires } from '../../../common/decorators/index.js'

import { RoleEntity, RolesService } from './roles.service.js'

/**
 * Catálogo de roles INTERNOS para el select del modal «Nuevo usuario».
 * Cuenta la misma historia que el alta: sin roles de hotel (nacen en la
 * Conversión, RR-V-02) ni Colaborador.
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Requires('users', 'manage')
  @Get()
  async list(): Promise<{ data: RoleEntity[] }> {
    return { data: await this.roles.internal() }
  }
}
