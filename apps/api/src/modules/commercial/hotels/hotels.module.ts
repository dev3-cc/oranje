import { Module } from '@nestjs/common'

import { HotelContactsController } from './hotel-contacts.controller.js'
import { HotelContactsRepository } from './hotel-contacts.repository.js'
import { HotelContactsService } from './hotel-contacts.service.js'
import { HotelsController } from './hotels.controller.js'
import { HotelsRepository } from './hotels.repository.js'
import { HotelsService } from './hotels.service.js'

@Module({
  controllers: [HotelsController, HotelContactsController],
  providers: [HotelsService, HotelsRepository, HotelContactsService, HotelContactsRepository],
  exports: [HotelsService, HotelContactsService],
})
export class HotelsModule {}
