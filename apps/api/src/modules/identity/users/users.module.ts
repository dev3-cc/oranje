import { Module } from '@nestjs/common'

import { HotelUsersController } from './hotel-users.controller.js'
import { HotelUsersRepository } from './hotel-users.repository.js'
import { HotelUsersService } from './hotel-users.service.js'

@Module({
  controllers: [HotelUsersController],
  providers: [HotelUsersService, HotelUsersRepository],
  exports: [HotelUsersService],
})
export class UsersModule {}
