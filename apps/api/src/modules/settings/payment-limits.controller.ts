import { Body, Controller, Get, Patch } from '@nestjs/common'

import { CurrentUser, Requires } from '../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../common/decorators/index.js'
import type { PaymentLimits } from '../settlement/payment-calendar/payment-calendar.js'

import { UpdatePaymentLimitsDto } from './dto/update-payment-limits.dto.js'
import { PaymentLimitsService } from './payment-limits.service.js'

/** Los límites de pago y aprobación: `settings:manage`, solo del Administrador. */
@Controller('settings/payment-limits')
export class PaymentLimitsController {
  constructor(private readonly service: PaymentLimitsService) {}

  @Requires('settings', 'manage')
  @Get()
  async read(): Promise<{ data: PaymentLimits }> {
    return { data: await this.service.read() }
  }

  @Requires('settings', 'manage')
  @Patch()
  async update(
    @Body() dto: UpdatePaymentLimitsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PaymentLimits }> {
    return { data: await this.service.update(dto, user) }
  }
}
