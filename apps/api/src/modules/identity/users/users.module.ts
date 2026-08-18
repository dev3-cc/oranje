import { Module } from '@nestjs/common'

import { HotelUsersController } from './hotel-users.controller.js'
import { HotelUsersRepository } from './hotel-users.repository.js'
import { HotelUsersService } from './hotel-users.service.js'
import { MeController } from './me.controller.js'
import { MeService } from './me.service.js'

@Module({
  controllers: [HotelUsersController, MeController],
  providers: [HotelUsersService, HotelUsersRepository, MeService],
  exports: [HotelUsersService, MeService],
})
export class UsersModule {}
