import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle } from '@nestjs/throttler'
import type { CookieOptions, Request, Response } from 'express'

import { CurrentUser, Public } from '../../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import type { Env } from '../../../config/env.validation.js'

import { AuthService, Session } from './auth.service.js'
import { CreateSessionDto } from './dto/create-session.dto.js'

const REFRESH_COOKIE = 'oranje_refresh'

// El refresh NO va en el body: va en la cookie.
interface SessionResponse {
  data: Omit<Session, 'refreshToken'>
}

@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: config.get('JWT_REFRESH_TTL_S', { infer: true }) * 1000,
    }
  }

  // Público porque es la puerta: el usuario todavía no tiene token de Oranje.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSessionDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const session = await this.auth.createSession(dto.idToken, this.userAgent(request))

    return this.respond(session, response)
  }

  // Cada llamada quema el refresh anterior: un token robado deja de servir en
  // cuanto el dueño renueva.
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const session = await this.auth.refresh(this.readCookie(request), this.userAgent(request))

    return this.respond(session, response)
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = (request.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE]

    if (token) {
      await this.auth.logout(token)
    }

    response.clearCookie(REFRESH_COOKIE, this.cookieOptions)
  }

  // Exige token: es una acción sobre la cuenta, no sobre la sesión que traes.
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: { closedSessions: number } }> {
    const closedSessions = await this.auth.logoutAll(user.id)
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions)

    return { data: { closedSessions } }
  }

  private respond(session: Session, response: Response): SessionResponse {
    const { refreshToken, ...rest } = session
    response.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions)

    return { data: rest }
  }

  private readCookie(request: Request): string {
    const token = (request.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE]

    if (!token) {
      throw new UnauthorizedException({
        code: 'REFRESH_MISSING',
        message: 'No hay sesión que renovar',
      })
    }

    return token
  }

  private userAgent(request: Request): string | null {
    return request.headers['user-agent'] ?? null
  }
}
