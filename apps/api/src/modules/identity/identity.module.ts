import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module.js'

// Submódulos: auth · users · roles
@Module({
  imports: [AuthModule],
})
export class IdentityModule {}
