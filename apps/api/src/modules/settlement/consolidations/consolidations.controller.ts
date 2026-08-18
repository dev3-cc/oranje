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

import { ConsolidationEntity, ConsolidationsService } from './consolidations.service.js'
import { CreateDeductionDto, GenerateDto } from './dto/generate.dto.js'

@Controller('consolidations')
export class ConsolidationsController {
  constructor(private readonly consolidations: ConsolidationsService) {}

  @Requires('payroll', 'read')
  @Get()
  async list(
    @Query('weekStart') weekStart?: string,
    @Query('status') status?: string,
  ): Promise<{ data: ConsolidationEntity[] }> {
    return {
      data: await this.consolidations.list(weekStart ? new Date(weekStart) : undefined, status),
    }
  }

  @Requires('payroll', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: ConsolidationEntity }> {
    return { data: await this.consolidations.get(id) }
  }

  @Requires('payroll', 'generate')
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Body() dto: GenerateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { created: number } }> {
    return { data: await this.consolidations.generate(dto, user) }
  }

  @Requires('payroll', 'manage_deductions')
  @Post(':id/deductions')
  @HttpCode(HttpStatus.CREATED)
  async addDeduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDeductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ConsolidationEntity }> {
    return { data: await this.consolidations.addDeduction(id, dto, user) }
  }

  @Requires('payroll', 'validate')
  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  async validate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ConsolidationEntity }> {
    return { data: await this.consolidations.validate(id, user) }
  }

  @Requires('payroll', 'authorize')
  @Post(':id/authorize')
  @HttpCode(HttpStatus.OK)
  async authorize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ConsolidationEntity }> {
    return { data: await this.consolidations.authorize(id, user) }
  }

  @Requires('payroll', 'mark_paid')
  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async pay(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: ConsolidationEntity }> {
    return { data: await this.consolidations.markPaid(id, user) }
  }
}
