import { Controller, Get } from '@nestjs/common'

import { CurrentUser } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { MeEntity, MeService } from './me.service.js'

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<{ data: MeEntity }> {
    return { data: await this.me.get(user) }
  }
}
