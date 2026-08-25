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

  /**
   * Sin `@Requires`: el permiso depende de QUIÉN pregunta. El propio territorio
   * se lee con `territory:read` (el BD lo tiene); el de otro exige
   * `team:read_members` (el BDC). Un solo par en el decorador dejaba al BD
   * fuera de su pantalla de Mi Territorio.
   */
  @Get('users/:id/zones')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TerritoryEntity }> {
    return { data: await this.territories.get(id, user) }
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
