import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/index.js'
import { NotificationsModule } from '../notifications/index.js'

import { AssignmentsController } from './assignments/assignments.controller.js'
import { AssignmentsRepository } from './assignments/assignments.repository.js'
import { AssignmentsService } from './assignments/assignments.service.js'
import { BlacklistController } from './blacklist/blacklist.controller.js'
import { BlacklistRepository } from './blacklist/blacklist.repository.js'
import { BlacklistService } from './blacklist/blacklist.service.js'
import { ParticipationController } from './participation/participation.controller.js'
import { ParticipationRepository } from './participation/participation.repository.js'
import { ParticipationService } from './participation/participation.service.js'
import { PayAdjustmentsController } from './pay-adjustments/pay-adjustments.controller.js'
import { PayAdjustmentsRepository } from './pay-adjustments/pay-adjustments.repository.js'
import { PayAdjustmentsService } from './pay-adjustments/pay-adjustments.service.js'

@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [
    ParticipationController,
    AssignmentsController,
    BlacklistController,
    PayAdjustmentsController,
  ],
  providers: [
    ParticipationService,
    ParticipationRepository,
    AssignmentsService,
    AssignmentsRepository,
    BlacklistService,
    BlacklistRepository,
    PayAdjustmentsService,
    PayAdjustmentsRepository,
  ],
  exports: [ParticipationService, AssignmentsService, BlacklistService, PayAdjustmentsService],
})
export class CoverageModule {}
