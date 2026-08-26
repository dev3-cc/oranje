import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/index.js'

import { BlacklistController } from './blacklist/blacklist.controller.js'
import { BlacklistRepository } from './blacklist/blacklist.repository.js'
import { BlacklistService } from './blacklist/blacklist.service.js'
import { AssignmentsController } from './assignments/assignments.controller.js'
import { AssignmentsRepository } from './assignments/assignments.repository.js'
import { AssignmentsService } from './assignments/assignments.service.js'
import { ParticipationController } from './participation/participation.controller.js'
import { ParticipationRepository } from './participation/participation.repository.js'
import { ParticipationService } from './participation/participation.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [ParticipationController, AssignmentsController, BlacklistController],
  providers: [
    ParticipationService,
    ParticipationRepository,
    AssignmentsService,
    AssignmentsRepository,
    BlacklistService,
    BlacklistRepository,
  ],
  exports: [ParticipationService, AssignmentsService, BlacklistService],
})
export class CoverageModule {}
