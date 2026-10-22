import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module.js'
import { UsersModule } from '../users/users.module.js'

import { TeamController } from './team.controller.js'
import { TeamService } from './team.service.js'

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
