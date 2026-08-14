import { Module } from '@nestjs/common'

import { HotelsController } from './hotels.controller.js'
import { HotelsRepository } from './hotels.repository.js'
import { HotelsService } from './hotels.service.js'

@Module({
  controllers: [HotelsController],
  providers: [HotelsService, HotelsRepository],
  exports: [HotelsService],
})
export class HotelsModule {}
