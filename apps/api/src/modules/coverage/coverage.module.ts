import { Module } from '@nestjs/common'

import { AssignmentsController } from './assignments/assignments.controller.js'
import { AssignmentsRepository } from './assignments/assignments.repository.js'
import { AssignmentsService } from './assignments/assignments.service.js'
import { ParticipationController } from './participation/participation.controller.js'
import { ParticipationRepository } from './participation/participation.repository.js'
import { ParticipationService } from './participation/participation.service.js'

@Module({
  controllers: [ParticipationController, AssignmentsController],
  providers: [
    ParticipationService,
    ParticipationRepository,
    AssignmentsService,
    AssignmentsRepository,
  ],
  exports: [ParticipationService, AssignmentsService],
})
export class CoverageModule {}
