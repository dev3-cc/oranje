import { Module } from '@nestjs/common'

import { HotelsModule } from './hotels/hotels.module.js'
import { OnboardingModule } from './onboarding/onboarding.module.js'

@Module({
  imports: [HotelsModule, OnboardingModule],
})
export class CommercialModule {}
