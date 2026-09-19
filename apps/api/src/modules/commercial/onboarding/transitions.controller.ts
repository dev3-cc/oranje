import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreateTransitionDto } from './dto/create-transition.dto.js'
import type { HistoryEntryEntity, TransitionOptionEntity } from './entities/transition.entity.js'
import { TransitionsService } from './transitions.service.js'

@Controller('prospects/:id')
export class TransitionsController {
  constructor(private readonly transitions: TransitionsService) {}

  @Requires('pipeline', 'read')
  @Get('transitions')
  async available(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TransitionOptionEntity[] }> {
    return { data: await this.transitions.available(id, user) }
  }

  @Requires('pipeline', 'read')
  @Get('history')
  async history(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: HistoryEntryEntity[] }> {
    return { data: await this.transitions.history(id) }
  }

  @Requires('pipeline', 'read')
  @Post('transitions')
  @HttpCode(HttpStatus.OK)
  async apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { from: string; to: string } }> {
    return { data: await this.transitions.apply(id, dto, user) }
  }
}
