import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { AccessTokenService } from './access-token.service.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { FirebaseTokenService } from './firebase-token.service.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js'
import { RefreshTokenRepository } from './refresh-token.repository.js'

@Module({
  imports: [
    // §6: rate limiting global; el login y el refresh lo aprietan con @Throttle
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    FirebaseTokenService,
    RefreshTokenRepository,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
