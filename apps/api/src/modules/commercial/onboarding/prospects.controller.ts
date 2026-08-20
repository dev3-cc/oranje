import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CloseProspectDto } from './dto/close-prospect.dto.js'
import { CreateProspectDto } from './dto/create-prospect.dto.js'
import { QueryProspectsDto } from './dto/query-prospects.dto.js'
import { UpdateProspectDto } from './dto/update-prospect.dto.js'
import type { ProspectEntity } from './entities/prospect.entity.js'
import { ProspectsService, Board } from './prospects.service.js'

@Controller('prospects')
export class ProspectsController {
  constructor(private readonly prospects: ProspectsService) {}

  @Requires('pipeline', 'read')
  @Get()
  list(@Query() query: QueryProspectsDto, @CurrentUser() user: AuthenticatedUser): Promise<Board> {
    return this.prospects.list(query, user)
  }

  @Requires('pipeline', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ProspectEntity }> {
    return { data: await this.prospects.get(id) }
  }

  @Requires('pipeline', 'create_prospect')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateProspectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProspectEntity }> {
    return { data: await this.prospects.create(dto, user) }
  }

  @Requires('pipeline', 'create_prospect')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProspectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProspectEntity }> {
    return { data: await this.prospects.update(id, dto, user) }
  }

  @Requires('pipeline', 'close_cycle')
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseProspectDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ProspectEntity }> {
    return { data: await this.prospects.close(id, dto, user) }
  }
}
