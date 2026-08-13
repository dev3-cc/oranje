import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { jwtVerify, SignJWT } from 'jose'

import type { Env } from '../../../config/env.validation.js'

/**
 * Lo que viaja dentro de NUESTRO token. Es deliberadamente corto: solo lo que
 * el guard necesita para decidir sin ir a la base en cada request.
 *
 * Los permisos NO van aquí. Viven en `identity.role_permission` y se consultan;
 * si viajaran en el token, revocarle un permiso a alguien tardaría 15 minutos
 * en surtir efecto.
 */
export interface AccessTokenPayload {
  /** Nuestro `identity.user.id`, no el uid de Firebase. */
  sub: string
  roleCode: string
  hotelId: string | null
  departmentId: string | null
}

const ISSUER = 'oranje-api'
const AUDIENCE = 'oranje'

@Injectable()
export class AccessTokenService {
  private readonly secret: Uint8Array
  private readonly ttlSeconds: number

  constructor(config: ConfigService<Env, true>) {
    this.secret = new TextEncoder().encode(config.get('JWT_SECRET', { infer: true }))
    this.ttlSeconds = config.get('JWT_ACCESS_TTL_S', { infer: true })
  }

  async sign(payload: AccessTokenPayload): Promise<{ token: string; expiresIn: number }> {
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(this.secret)

    return { token, expiresIn: this.ttlSeconds }
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
      })

      return {
        sub: payload.sub as string,
        roleCode: payload['roleCode'] as string,
        hotelId: (payload['hotelId'] as string | null) ?? null,
        departmentId: (payload['departmentId'] as string | null) ?? null,
      }
    } catch {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Token inválido o expirado',
      })
    }
  }
}
