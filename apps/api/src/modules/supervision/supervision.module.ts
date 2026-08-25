import { Module } from '@nestjs/common'

import { AccidentsController } from './accidents/accidents.controller.js'
import { AccidentsRepository } from './accidents/accidents.repository.js'
import { AccidentsService } from './accidents/accidents.service.js'

@Module({
  controllers: [AccidentsController],
  providers: [AccidentsService, AccidentsRepository],
  exports: [AccidentsService],
})
export class SupervisionModule {}
