import { Module } from '@nestjs/common'

import { ObservabilityController } from './observability.controller.js'
import { ObservabilityRepository } from './observability.repository.js'
import { ObservabilityService } from './observability.service.js'

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityRepository, ObservabilityService],
})
export class ObservabilityModule {}
