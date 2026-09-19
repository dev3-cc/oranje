import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { BlacklistService, EntryEntity } from './blacklist.service.js'
import { CreateEntryDto, LiftDto } from './dto/blacklist.dto.js'

@Controller()
export class BlacklistController {
  constructor(private readonly blacklist: BlacklistService) {}

  @Requires('blacklist', 'read')
  @Get('blacklist')
  async list(
    @Query('workerId') workerId?: string,
    @Query('onlyActive') onlyActive?: string,
  ): Promise<{ data: EntryEntity[] }> {
    return { data: await this.blacklist.list(workerId, onlyActive === 'true') }
  }

  @Requires('blacklist', 'read')
  @Get('workers/:id/blacklist')
  async history(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: EntryEntity[] }> {
    return { data: await this.blacklist.list(id) }
  }

  @Requires('blacklist', 'create')
  @Post('workers/:id/blacklist')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: EntryEntity }> {
    return { data: await this.blacklist.create(id, dto, user) }
  }

  @Requires('blacklist', 'lift')
  @Post('workers/:id/blacklist/lift')
  @HttpCode(HttpStatus.OK)
  async lift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LiftDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: EntryEntity }> {
    return { data: await this.blacklist.lift(id, dto, user) }
  }
}
