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

import { CloseRateDto, CreateRateDto } from './dto/rate.dto.js'
import { RateEntity, RatesService } from './rates.service.js'

@Controller('workers/:id/rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Requires('payroll', 'read')
  @Get()
  async list(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: RateEntity[] }> {
    return { data: await this.rates.list(id) }
  }

  @Requires('payroll', 'manage_deductions')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RateEntity }> {
    return { data: await this.rates.create(id, dto, user) }
  }

  @Requires('payroll', 'manage_deductions')
  @Post(':rateId/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rateId', ParseUUIDPipe) rateId: string,
    @Body() dto: CloseRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: RateEntity }> {
    return { data: await this.rates.close(id, rateId, dto, user) }
  }
}
