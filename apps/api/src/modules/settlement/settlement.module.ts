import { Module } from '@nestjs/common'

import { ConsolidationsController } from './consolidations/consolidations.controller.js'
import { ConsolidationsRepository } from './consolidations/consolidations.repository.js'
import { ConsolidationsService } from './consolidations/consolidations.service.js'
import { InvoicesController } from './invoices/invoices.controller.js'
import { InvoicesRepository } from './invoices/invoices.repository.js'
import { InvoicesService } from './invoices/invoices.service.js'

@Module({
  controllers: [ConsolidationsController, InvoicesController],
  providers: [ConsolidationsService, ConsolidationsRepository, InvoicesService, InvoicesRepository],
  exports: [ConsolidationsService, InvoicesService],
})
export class SettlementModule {}
