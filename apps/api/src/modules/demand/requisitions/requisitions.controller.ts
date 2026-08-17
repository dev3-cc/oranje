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

import { CreateRequisitionDto } from './dto/create-requisition.dto.js'
import { QueryRequisitionsDto } from './dto/query-requisitions.dto.js'
import type { RequisitionEntity } from './entities/requisition.entity.js'
import { RequisitionBoard, RequisitionsService } from './requisitions.service.js'

@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitions: RequisitionsService) {}

  @Requires('requisitions', 'read_own')
  @Get()
  list(
    @Query() query: QueryRequisitionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequisitionBoard> {
    return this.requisitions.list(query, user)
  }

  @Requires('requisitions', 'read_own')
  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.get(id, user) }
  }

  @Requires('requisitions', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.create(dto, user) }
  }

  @Requires('requisitions', 'authorize')
  @Post(':id/authorize')
  @HttpCode(HttpStatus.OK)
  async authorize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RequisitionEntity }> {
    return { data: await this.requisitions.authorize(id, user) }
  }
}
