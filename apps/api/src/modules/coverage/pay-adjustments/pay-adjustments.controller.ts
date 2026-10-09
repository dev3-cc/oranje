import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { CreatePayAdjustmentDto } from './dto/create-pay-adjustment.dto.js'
import { RejectPayAdjustmentDto } from './dto/reject-pay-adjustment.dto.js'
import { PayAdjustmentEntity, PayAdjustmentsService } from './pay-adjustments.service.js'

@Controller()
export class PayAdjustmentsController {
  constructor(private readonly payAdjustments: PayAdjustmentsService) {}

  @Requires('requisitions', 'request_pay_adjustment')
  @Post('assignments/:id/pay-adjustments')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePayAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PayAdjustmentEntity }> {
    return { data: await this.payAdjustments.create(id, dto, user) }
  }

  /** Sin `@Requires`: dos permisos válidos (pedir o aprobar); decide el servicio. */
  @Get('assignments/:id/pay-adjustments')
  async byAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PayAdjustmentEntity[] }> {
    return { data: await this.payAdjustments.byAssignment(id, user) }
  }

  /** La cola del Observador: todo lo PENDING, de cualquier hotel. */
  @Requires('requisitions', 'approve_pay_adjustment')
  @Get('pay-adjustments/pending')
  async pending(): Promise<{ data: PayAdjustmentEntity[] }> {
    return { data: await this.payAdjustments.pending() }
  }

  @Requires('requisitions', 'approve_pay_adjustment')
  @Post('pay-adjustments/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PayAdjustmentEntity }> {
    return { data: await this.payAdjustments.approve(id, user) }
  }

  @Requires('requisitions', 'approve_pay_adjustment')
  @Post('pay-adjustments/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPayAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PayAdjustmentEntity }> {
    return { data: await this.payAdjustments.reject(id, dto.reason, user) }
  }
}
