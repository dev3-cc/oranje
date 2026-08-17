import { Module } from '@nestjs/common'

import { SchedulesController } from './schedules/schedules.controller.js'
import { SchedulesRepository } from './schedules/schedules.repository.js'
import { SchedulesService } from './schedules/schedules.service.js'
import { TimesheetsController } from './timesheets/timesheets.controller.js'
import { TimesheetsRepository } from './timesheets/timesheets.repository.js'
import { TimesheetsService } from './timesheets/timesheets.service.js'

@Module({
  controllers: [SchedulesController, TimesheetsController],
  providers: [SchedulesService, SchedulesRepository, TimesheetsService, TimesheetsRepository],
  exports: [SchedulesService, TimesheetsService],
})
export class OperationsModule {}
