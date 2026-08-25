import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import type { WorkerEntity } from '../workers/entities/worker.entity.js'

import { CompleteSignupDto, UpdateOwnContactDto } from './dto/me.dto.js'
import { MeService } from './me.service.js'
import type { TaxDeadline } from './tax-deadline.service.js'

@Controller('workers/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Requires('worker', 'read_own')
  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity & { taxDeadline: TaxDeadline } }> {
    return { data: await this.me.get(user) }
  }

  @Requires('worker', 'complete_signup')
  @Patch('signup')
  async completeSignup(
    @Body() dto: CompleteSignupDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.me.completeSignup(dto, user) }
  }

  @Requires('worker', 'update_own_contact')
  @Patch()
  async updateContact(
    @Body() dto: UpdateOwnContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: WorkerEntity }> {
    return { data: await this.me.updateContact(dto, user) }
  }

  // Solo activa. La vuelta a Verde fuerte NO tiene transición en el Semáforo
  // del Colaborador —solo la menciona `04 - Permisos Detallados`—, así que no
  // se inventa aquí.
  @Requires('worker', 'set_availability')
  @Post('availability')
  @HttpCode(HttpStatus.OK)
  async setAvailable(@CurrentUser() user: AuthenticatedUser): Promise<{ data: WorkerEntity }> {
    return { data: await this.me.setAvailable(user) }
  }
}
