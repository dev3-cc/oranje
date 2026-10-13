import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'

import { CurrentUser, Requires } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { PaymentRunDto } from './dto/payment-run.dto.js'
import { PaymentRunResult, PaymentRunsService } from './payment-runs.service.js'

/**
 * Una corrida de pago. Contabilidad la dispara a mano; un programador podrá
 * llamar lo mismo cuando exista el disparador (pendiente).
 */
@Controller('payment-runs')
export class PaymentRunsController {
  constructor(private readonly runs: PaymentRunsService) {}

  @Requires('payroll', 'generate')
  @Post()
  @HttpCode(HttpStatus.OK)
  async run(
    @Body() dto: PaymentRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: PaymentRunResult }> {
    return { data: await this.runs.run(dto, user) }
  }
}
