import { Module } from '@nestjs/common'

import { IdentityModule } from '../../identity/index.js'

import { ProspectsController } from './prospects.controller.js'
import { ProspectsRepository } from './prospects.repository.js'
import { ProspectsService } from './prospects.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [ProspectsController],
  providers: [ProspectsService, ProspectsRepository],
  exports: [ProspectsService],
})
export class OnboardingModule {}
