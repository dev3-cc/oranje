import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { SetZonesDto } from './dto/territory.dto.js'
import { TerritoriesService, TerritoryEntity } from './territories.service.js'

@Controller()
export class TerritoriesController {
  constructor(private readonly territories: TerritoriesService) {}

  @Requires('team', 'read_members')
  @Get('users/:id/zones')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: TerritoryEntity }> {
    return { data: await this.territories.get(id) }
  }

  @Requires('territory', 'assign')
  @Put('users/:id/zones')
  @HttpCode(HttpStatus.OK)
  async set(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetZonesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TerritoryEntity }> {
    return { data: await this.territories.set(id, dto, user) }
  }

  @Requires('territory', 'read_prospects')
  @Get('zones/:id/holders')
  async holders(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: Array<{ id: string; fullName: string }> }> {
    return { data: await this.territories.holders(id) }
  }
}
