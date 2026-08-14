import { Module } from '@nestjs/common'

import { HotelsModule } from './hotels/hotels.module.js'

@Module({
  imports: [HotelsModule],
})
export class CommercialModule {}
