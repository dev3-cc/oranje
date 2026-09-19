import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'

import type { Env } from '../../../config/env.validation.js'

export interface FirebaseIdentity {
  uid: string
  email: string | null
}

const JWKS_DE_GOOGLE =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

// Sin firebase-admin: verificar una firma contra un JWKS público no justifica
// una llave de cuenta de servicio en cada ambiente.
//
// Si el issuer dice localhost se asume el EMULADOR y el token se decodifica sin
// verificar. Con Firebase real se verifica contra el JWKS de Google.
@Injectable()
export class FirebaseTokenService {
  private readonly logger = new Logger(FirebaseTokenService.name)
  private readonly issuer: string | undefined
  private readonly audience: string | undefined
  private readonly isEmulator: boolean
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null

  constructor(config: ConfigService<Env, true>) {
    this.issuer = config.get('AUTH_ISSUER_URL', { infer: true })
    this.audience = config.get('AUTH_AUDIENCE', { infer: true })
    this.isEmulator =
      this.issuer?.includes('localhost') === true || this.issuer?.includes('127.0.0.1') === true

    this.jwks = this.issuer && !this.isEmulator ? createRemoteJWKSet(new URL(JWKS_DE_GOOGLE)) : null

    if (!this.issuer) {
      this.logger.warn('Sin Firebase configurado: POST /auth/session responderá 503')
    } else if (this.isEmulator) {
      this.logger.warn('Emulador de Firebase: los ID tokens NO se verifican')
    }
  }

  async verify(idToken: string): Promise<FirebaseIdentity> {
    if (!this.issuer || !this.audience) {
      throw new ServiceUnavailableException({
        code: 'LOGIN_NOT_CONFIGURED',
        message: 'El proveedor de identidad no está configurado en este ambiente',
      })
    }

    const claims = this.jwks
      ? (
          await jwtVerify(idToken, this.jwks, {
            issuer: this.issuer,
            audience: this.audience,
          }).catch(() => {
            throw new UnauthorizedException({
              code: 'FIREBASE_TOKEN_INVALID',
              message: 'El token de Firebase no es válido',
            })
          })
        ).payload
      : decodeJwt(idToken)

    const uid = claims.sub

    if (!uid) {
      throw new UnauthorizedException({
        code: 'FIREBASE_TOKEN_INVALID',
        message: 'El token de Firebase no trae uid',
      })
    }

    return { uid, email: (claims['email'] as string | undefined) ?? null }
  }
}
