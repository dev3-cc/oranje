import { Module } from '@nestjs/common'

import { IdentityModule } from '../../identity/index.js'

import { ProspectsController } from './prospects.controller.js'
import { ProspectsRepository } from './prospects.repository.js'
import { ProspectsService } from './prospects.service.js'
import { TransitionsController } from './transitions.controller.js'
import { TransitionsRepository } from './transitions.repository.js'
import { TransitionsService } from './transitions.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [ProspectsController, TransitionsController],
  providers: [ProspectsService, ProspectsRepository, TransitionsService, TransitionsRepository],
  exports: [ProspectsService, TransitionsService],
})
export class OnboardingModule {}
