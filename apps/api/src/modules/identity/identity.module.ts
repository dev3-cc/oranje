import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module.js'
import { RolesModule } from './roles/roles.module.js'
import { TeamModule } from './team/team.module.js'
import { UsersModule } from './users/users.module.js'

@Module({
  imports: [AuthModule, UsersModule, TeamModule, RolesModule],
  exports: [AuthModule, UsersModule, TeamModule, RolesModule],
})
export class IdentityModule {}
