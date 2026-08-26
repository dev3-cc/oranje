import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { ParticipantEntity, ParticipationResult, ParticipationService } from './participation.service.js'

@Controller('requisitions/:id/participants')
export class ParticipationController {
  constructor(private readonly participation: ParticipationService) {}

  @Requires('requisitions', 'read_active_recruiters')
  @Get()
  async list(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ParticipantEntity[] }> {
    return { data: await this.participation.list(id) }
  }

  @Requires('requisitions', 'take')
  @Post()
  @HttpCode(HttpStatus.OK)
  async join(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ParticipationResult }> {
    return { data: await this.participation.join(id, user) }
  }

  @Requires('requisitions', 'leave')
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ParticipationResult }> {
    return { data: await this.participation.leave(id, user) }
  }
}
