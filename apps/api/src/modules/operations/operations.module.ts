import { Module } from '@nestjs/common'

import { SchedulerTokenService } from '../../common/security/scheduler-token.service.js'
import { IdentityModule } from '../identity/index.js'
import { NotificationsModule } from '../notifications/index.js'

import { SchedulesController } from './schedules/schedules.controller.js'
import { SchedulesRepository } from './schedules/schedules.repository.js'
import { SchedulesService } from './schedules/schedules.service.js'
import { TimesheetsController } from './timesheets/timesheets.controller.js'
import { TimesheetsRepository } from './timesheets/timesheets.repository.js'
import { TimesheetsService } from './timesheets/timesheets.service.js'

@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [SchedulesController, TimesheetsController],
  providers: [
    SchedulesService,
    SchedulesRepository,
    TimesheetsService,
    TimesheetsRepository,
    SchedulerTokenService,
  ],
  exports: [SchedulesService, TimesheetsService],
})
export class OperationsModule {}
