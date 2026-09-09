import { Module } from '@nestjs/common'

import { AccidentsController } from './accidents/accidents.controller.js'
import { AccidentsRepository } from './accidents/accidents.repository.js'
import { AccidentsService } from './accidents/accidents.service.js'
import { AuditsController } from './audits/audits.controller.js'
import { AuditsRepository } from './audits/audits.repository.js'
import { AuditsService } from './audits/audits.service.js'

@Module({
  controllers: [AccidentsController, AuditsController],
  providers: [AccidentsService, AccidentsRepository, AuditsService, AuditsRepository],
  exports: [AccidentsService, AuditsService],
})
export class SupervisionModule {}
