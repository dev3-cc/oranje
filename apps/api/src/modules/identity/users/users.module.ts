import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module.js'

import { FirebaseAccountsService } from './firebase-accounts.service.js'
import { HotelUsersController, HotelUsersDirectoryController } from './hotel-users.controller.js'
import { HotelUsersRepository } from './hotel-users.repository.js'
import { HotelUsersService } from './hotel-users.service.js'
import { MeController } from './me.controller.js'
import { MeService } from './me.service.js'
import { StaffUsersController } from './staff-users.controller.js'
import { StaffUsersRepository } from './staff-users.repository.js'
import { StaffUsersService } from './staff-users.service.js'

@Module({
  imports: [AuthModule],
  controllers: [
    HotelUsersController,
    HotelUsersDirectoryController,
    MeController,
    StaffUsersController,
  ],
  providers: [
    HotelUsersService,
    HotelUsersRepository,
    MeService,
    StaffUsersService,
    StaffUsersRepository,
    FirebaseAccountsService,
  ],
  exports: [HotelUsersService, MeService, StaffUsersService],
})
export class UsersModule {}
