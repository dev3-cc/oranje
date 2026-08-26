import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import type { Env } from '../../../config/env.validation.js'

import { AccessTokenService } from './access-token.service.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { FirebaseTokenService } from './firebase-token.service.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js'
import { PermissionsGuard } from './guards/permissions.guard.js'
import { PermissionsService } from './permissions.service.js'
import { RefreshTokenRepository } from './refresh-token.repository.js'

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { ttl: 60_000, limit: config.get('RATE_LIMIT_PER_MINUTE', { infer: true }) },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    FirebaseTokenService,
    RefreshTokenRepository,
    PermissionsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // El orden importa: primero quién eres, después qué puedes.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AccessTokenService, PermissionsService],
})
export class AuthModule {}
