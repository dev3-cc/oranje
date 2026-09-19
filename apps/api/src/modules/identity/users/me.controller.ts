import { Body, Controller, Get, Patch } from '@nestjs/common'

import { CurrentUser } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { UpdateMeDto } from './dto/update-me.dto.js'
import { MeEntity, MeService } from './me.service.js'

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<{ data: MeEntity }> {
    return { data: await this.me.get(user) }
  }

  /** Sin @Requires: cada quien edita su idioma. */
  @Patch()
  async update(
    @Body() dto: UpdateMeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: MeEntity }> {
    return { data: await this.me.updateLocale(user, dto.locale) }
  }
}
