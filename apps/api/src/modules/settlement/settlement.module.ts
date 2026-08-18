import { Module } from '@nestjs/common'

import { ConsolidationsController } from './consolidations/consolidations.controller.js'
import { ConsolidationsRepository } from './consolidations/consolidations.repository.js'
import { ConsolidationsService } from './consolidations/consolidations.service.js'

@Module({
  controllers: [ConsolidationsController],
  providers: [ConsolidationsService, ConsolidationsRepository],
  exports: [ConsolidationsService],
})
export class SettlementModule {}
