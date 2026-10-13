import { Module } from '@nestjs/common'

import { MailSettingsController } from './mail-settings.controller.js'
import { MailSettingsService } from './mail-settings.service.js'
import { PaymentLimitsController } from './payment-limits.controller.js'
import { PaymentLimitsService } from './payment-limits.service.js'

@Module({
  controllers: [MailSettingsController, PaymentLimitsController],
  providers: [MailSettingsService, PaymentLimitsService],
  exports: [PaymentLimitsService],
})
export class AppSettingsModule {}
