import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose'
import type { CryptoKey, KeyObject } from 'jose'

import type { Env } from '../../../config/env.validation.js'

/**
 * Lo que viaja en nuestro token: solo lo que el guard necesita para decidir sin
 * ir a la base. Los permisos NO van aquí — se consultan, porque en el token
 * revocar uno tardaría 15 minutos en surtir efecto.
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

type Llave = CryptoKey | KeyObject | Uint8Array

/**
 * Firma y verifica el token que protege los CRUD.
 *
 * El algoritmo depende del ambiente: en local basta un secreto compartido, pero
 * con HS256 quien verifica también puede firmar. En los desplegados va RS256,
 * así que la llave privada solo vive donde se emiten los tokens.
 */
@Injectable()
export class AccessTokenService {
  private readonly logger = new Logger(AccessTokenService.name)
  private readonly alg: 'HS256' | 'RS256'
  private readonly ttlSeconds: number
  private readonly llaves: Promise<{ firma: Llave; verificacion: Llave }>

  constructor(config: ConfigService<Env, true>) {
    const appEnv = config.get('APP_ENV', { infer: true })

    this.alg = appEnv === 'local' ? 'HS256' : 'RS256'
    this.ttlSeconds = config.get('JWT_ACCESS_TTL_S', { infer: true })
    this.llaves = this.cargarLlaves(config)

    this.logger.log(`Tokens firmados con ${this.alg} (APP_ENV=${appEnv})`)
  }

  async sign(payload: AccessTokenPayload): Promise<{ token: string; expiresIn: number }> {
    const { firma } = await this.llaves

    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: this.alg })
      .setSubject(payload.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.ttlSeconds}s`)
      .sign(firma)

    return { token, expiresIn: this.ttlSeconds }
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const { verificacion } = await this.llaves

      // El algoritmo se fija: sin esto, un token firmado con otro alg pasaría
      const { payload } = await jwtVerify(token, verificacion, {
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

  private async cargarLlaves(
    config: ConfigService<Env, true>,
  ): Promise<{ firma: Llave; verificacion: Llave }> {
    if (this.alg === 'HS256') {
      // La validación de entorno ya garantizó que existe fuera de los desplegados
      const secreto = new TextEncoder().encode(config.get('JWT_SECRET', { infer: true }))

      return { firma: secreto, verificacion: secreto }
    }

    const privada = config.get('JWT_PRIVATE_KEY', { infer: true })
    const publica = config.get('JWT_PUBLIC_KEY', { infer: true })

    // La validación de entorno ya las exigió fuera de local; esto es el cinturón
    if (!privada || !publica) {
      throw new Error('RS256 exige JWT_PRIVATE_KEY y JWT_PUBLIC_KEY')
    }

    return {
      firma: await importPKCS8(normalizarPem(privada), 'RS256'),
      verificacion: await importSPKI(normalizarPem(publica), 'RS256'),
    }
  }
}

/**
 * Secret Manager y los `.env` entregan los saltos del PEM como `\n` literales.
 * Sin esto la llave no importa, y el error de jose no dice por qué.
 */
function normalizarPem(valor: string): string {
  return valor.includes('\\n') ? valor.replace(/\\n/g, '\n') : valor
}
