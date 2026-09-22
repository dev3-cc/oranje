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

  /**
   * Antes de `:id` a propósito: si no, Nest la toma como el parámetro y
   * `ParseUUIDPipe` la rechaza. Un permiso propio (`requisitions:read_position_pay`)
   * en vez de `terms_and_conditions:read`: Reclutamiento no ve el contrato
   * completo, solo el pago de la posición que va a asignar.
   */
  @Requires('requisitions', 'read_position_pay')
  @Get('position-rate')
  async positionRate(
    @Query('hotelId', ParseUUIDPipe) hotelId: string,
    @Query('catalogPositionId', ParseUUIDPipe) catalogPositionId: string,
  ): Promise<{ data: { payRate: string; contractNumber: string } | null }> {
    return { data: await this.contracts.positionPayRate(hotelId, catalogPositionId) }
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
