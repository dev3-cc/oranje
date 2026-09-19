import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose'
import type { CryptoKey, KeyObject } from 'jose'

import type { Env } from '../../../config/env.validation.js'

// Los permisos NO viajan aquí: en el token, revocar uno tardaría 15 minutos
// en surtir efecto.
export interface AccessTokenPayload {
  sub: string
  roleCode: string
  hotelId: string | null
  departmentId: string | null
}

const ISSUER = 'oranje-api'
const AUDIENCE = 'oranje'

type SigningKey = CryptoKey | KeyObject | Uint8Array

// HS256 en local; RS256 en los desplegados, para que quien verifica no pueda
// firmar.
@Injectable()
export class AccessTokenService {
  private readonly logger = new Logger(AccessTokenService.name)
  private readonly alg: 'HS256' | 'RS256'
  private readonly ttlSeconds: number
  private readonly keys: Promise<{ signing: SigningKey; verification: SigningKey }>

  constructor(config: ConfigService<Env, true>) {
    const appEnv = config.get('APP_ENV', { infer: true })

    this.alg = appEnv === 'local' ? 'HS256' : 'RS256'
    this.ttlSeconds = config.get('JWT_ACCESS_TTL_S', { infer: true })
    this.keys = this.loadKeys(config)

    this.logger.log(`Tokens firmados con ${this.alg} (APP_ENV=${appEnv})`)
  }

  async sign(payload: AccessTokenPayload): Promise<{ token: string; expiresIn: number }> {
    const { signing } = await this.keys

    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: this.alg })
      .setSubject(payload.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(signing)

    return { token, expiresIn: this.ttlSeconds }
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const { verification } = await this.keys

      // Se fija el algoritmo: si no, un token firmado con otro pasaría.
      const { payload } = await jwtVerify(token, verification, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: [this.alg],
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

  private async loadKeys(
    config: ConfigService<Env, true>,
  ): Promise<{ signing: SigningKey; verification: SigningKey }> {
    if (this.alg === 'HS256') {
      const secret = new TextEncoder().encode(config.get('JWT_SECRET', { infer: true }))

      return { signing: secret, verification: secret }
    }

    const privateKey = config.get('JWT_PRIVATE_KEY', { infer: true })
    const publicKey = config.get('JWT_PUBLIC_KEY', { infer: true })

    if (!privateKey || !publicKey) {
      throw new Error('RS256 exige JWT_PRIVATE_KEY y JWT_PUBLIC_KEY')
    }

    return {
      signing: await importPKCS8(normalizePem(privateKey), 'RS256'),
      verification: await importSPKI(normalizePem(publicKey), 'RS256'),
    }
  }
}

// Secret Manager y los .env entregan los saltos del PEM como `\n` literales.
function normalizePem(valor: string): string {
  return valor.includes('\\n') ? valor.replace(/\\n/g, '\n') : valor
}
