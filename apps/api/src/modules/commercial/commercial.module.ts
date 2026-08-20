import { Module } from '@nestjs/common'

import { ContractsModule } from './contracts/contracts.module.js'
import { HotelsModule } from './hotels/hotels.module.js'
import { OnboardingModule } from './onboarding/onboarding.module.js'

@Module({
  imports: [HotelsModule, OnboardingModule, ContractsModule],
})
export class CommercialModule {}
