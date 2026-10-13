import { Module } from '@nestjs/common'

import { NotificationsModule } from '../notifications/index.js'
import { ObservabilityModule } from '../observability/observability.module.js'
import { AppSettingsModule } from '../settings/index.js'

import { ConsolidationsController } from './consolidations/consolidations.controller.js'
import { ConsolidationsRepository } from './consolidations/consolidations.repository.js'
import { ConsolidationsService } from './consolidations/consolidations.service.js'
import { HoursWeekNoticeController } from './hours-week-notice/hours-week-notice.controller.js'
import { HoursWeekNoticeRepository } from './hours-week-notice/hours-week-notice.repository.js'
import { HoursWeekNoticeService } from './hours-week-notice/hours-week-notice.service.js'
import { InvoicesController } from './invoices/invoices.controller.js'
import { InvoicesRepository } from './invoices/invoices.repository.js'
import { InvoicesService } from './invoices/invoices.service.js'
import { PaymentRunsController } from './payment-runs/payment-runs.controller.js'
import { PaymentRunsRepository } from './payment-runs/payment-runs.repository.js'
import { PaymentRunsService } from './payment-runs/payment-runs.service.js'
import { HoursPendingAlertService } from './pending-approvals/hours-pending-alert.service.js'
import { PendingApprovalsController } from './pending-approvals/pending-approvals.controller.js'
import { PendingApprovalsRepository } from './pending-approvals/pending-approvals.repository.js'
import { PendingApprovalsService } from './pending-approvals/pending-approvals.service.js'

@Module({
  imports: [NotificationsModule, ObservabilityModule, AppSettingsModule],
  controllers: [
    ConsolidationsController,
    InvoicesController,
    PendingApprovalsController,
    PaymentRunsController,
    HoursWeekNoticeController,
  ],
  providers: [
    ConsolidationsService,
    ConsolidationsRepository,
    InvoicesService,
    InvoicesRepository,
    PendingApprovalsRepository,
    PendingApprovalsService,
    HoursPendingAlertService,
    PaymentRunsRepository,
    PaymentRunsService,
    HoursWeekNoticeRepository,
    HoursWeekNoticeService,
  ],
  exports: [ConsolidationsService, InvoicesService, HoursPendingAlertService],
})
export class SettlementModule {}
