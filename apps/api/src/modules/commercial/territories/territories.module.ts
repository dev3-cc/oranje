import { Module } from '@nestjs/common'

import { IdentityModule } from '../../identity/index.js'

import { TerritoriesController } from './territories.controller.js'
import { TerritoriesRepository } from './territories.repository.js'
import { TerritoriesService } from './territories.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [TerritoriesController],
  providers: [TerritoriesService, TerritoriesRepository],
  exports: [TerritoriesService],
})
export class TerritoriesModule {}
