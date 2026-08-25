import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module.js'
import { TeamModule } from './team/team.module.js'
import { UsersModule } from './users/users.module.js'

@Module({
  imports: [AuthModule, UsersModule, TeamModule],
  exports: [AuthModule, UsersModule, TeamModule],
})
export class IdentityModule {}
