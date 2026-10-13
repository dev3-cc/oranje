import { Module } from '@nestjs/common'

import { ApprovalTimelinessRepository } from './approval-timeliness/approval-timeliness.repository.js'
import { ApprovalTimelinessService } from './approval-timeliness/approval-timeliness.service.js'
import { ObservabilityController } from './observability.controller.js'
import { ObservabilityRepository } from './observability.repository.js'
import { ObservabilityService } from './observability.service.js'

@Module({
  controllers: [ObservabilityController],
  providers: [
    ObservabilityRepository,
    ObservabilityService,
    ApprovalTimelinessRepository,
    ApprovalTimelinessService,
  ],
  // Contabilidad (settlement) muestra el mismo KPI: una sola fuente de cálculo.
  exports: [ApprovalTimelinessService],
})
export class ObservabilityModule {}
