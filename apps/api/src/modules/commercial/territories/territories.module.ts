import { Module } from '@nestjs/common'

import { TerritoriesController } from './territories.controller.js'
import { TerritoriesRepository } from './territories.repository.js'
import { TerritoriesService } from './territories.service.js'

@Module({
  controllers: [TerritoriesController],
  providers: [TerritoriesService, TerritoriesRepository],
  exports: [TerritoriesService],
})
export class TerritoriesModule {}
