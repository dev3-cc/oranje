import { Module } from '@nestjs/common'

import { ContractsController } from './contracts.controller.js'
import { ContractsRepository } from './contracts.repository.js'
import { ContractsService } from './contracts.service.js'

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, ContractsRepository],
  exports: [ContractsService],
})
export class ContractsModule {}
