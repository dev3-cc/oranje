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

import { CreditDto, GenerateInvoiceDto } from './dto/invoice.dto.js'
import { InvoiceEntity, InvoicesService } from './invoices.service.js'

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Requires('payroll', 'read')
  @Get()
  async list(
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: string,
  ): Promise<{ data: InvoiceEntity[] }> {
    return { data: await this.invoices.list(hotelId, status) }
  }

  @Requires('payroll', 'read')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ data: InvoiceEntity }> {
    return { data: await this.invoices.get(id) }
  }

  @Requires('payroll', 'generate')
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Body() dto: GenerateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: InvoiceEntity }> {
    return { data: await this.invoices.generate(dto, user) }
  }

  @Requires('payroll', 'manage_deductions')
  @Post(':id/credit')
  @HttpCode(HttpStatus.CREATED)
  async credit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreditDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: InvoiceEntity }> {
    return { data: await this.invoices.credit(id, dto, user) }
  }

  @Requires('payroll', 'authorize')
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: InvoiceEntity }> {
    return { data: await this.invoices.approve(id, user) }
  }

  @Requires('payroll', 'authorize')
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: InvoiceEntity }> {
    return { data: await this.invoices.send(id, user) }
  }

  @Requires('payroll', 'mark_paid')
  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  async pay(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: InvoiceEntity }> {
    return { data: await this.invoices.markPaid(id, user) }
  }
}
