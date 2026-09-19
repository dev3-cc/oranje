import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { ContractEntity, ContractsService } from './contracts.service.js'
import { CreateContractDto, UpsertRateDto } from './dto/contract.dto.js'

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Requires('terms_and_conditions', 'read')
  @Get()
  async list(
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: string,
  ): Promise<{ data: ContractEntity[] }> {
    return { data: await this.contracts.list(hotelId, status) }
  }

  @Requires('terms_and_conditions', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.get(id) }
  }

  @Requires('terms_and_conditions', 'create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.create(dto, user) }
  }

  @Requires('terms_and_conditions', 'update')
  @Put(':id/rates')
  @HttpCode(HttpStatus.OK)
  async setRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.setRate(id, dto, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.activate(id, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/expire')
  @HttpCode(HttpStatus.OK)
  async expire(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.close(id, true, user) }
  }

  @Requires('terms_and_conditions', 'approve')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ContractEntity }> {
    return { data: await this.contracts.close(id, false, user) }
  }
}
