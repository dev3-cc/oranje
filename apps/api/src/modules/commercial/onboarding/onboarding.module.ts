import { Module } from '@nestjs/common'

import { IdentityModule } from '../../identity/index.js'

import { ContactAttemptsController } from './contact-attempts.controller.js'
import { ContactAttemptsRepository } from './contact-attempts.repository.js'
import { ContactAttemptsService } from './contact-attempts.service.js'
import { ProposalsController } from './proposals.controller.js'
import { ProposalsRepository } from './proposals.repository.js'
import { ProposalsService } from './proposals.service.js'
import { ProspectsController } from './prospects.controller.js'
import { ProspectsRepository } from './prospects.repository.js'
import { ProspectsService } from './prospects.service.js'
import { TransitionsController } from './transitions.controller.js'
import { TransitionsRepository } from './transitions.repository.js'
import { TransitionsService } from './transitions.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [
    ProspectsController,
    TransitionsController,
    ContactAttemptsController,
    ProposalsController,
  ],
  providers: [
    ProspectsService,
    ProspectsRepository,
    TransitionsService,
    TransitionsRepository,
    ContactAttemptsService,
    ContactAttemptsRepository,
    ProposalsService,
    ProposalsRepository,
  ],
  exports: [ProspectsService, TransitionsService, ContactAttemptsService, ProposalsService],
})
export class OnboardingModule {}
