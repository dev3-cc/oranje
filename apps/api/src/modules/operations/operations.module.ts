import { Module } from '@nestjs/common'

import { SchedulesController } from './schedules/schedules.controller.js'
import { SchedulesRepository } from './schedules/schedules.repository.js'
import { SchedulesService } from './schedules/schedules.service.js'

@Module({
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesRepository],
  exports: [SchedulesService],
})
export class OperationsModule {}
