import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'

import type { Env } from '../../../config/env.validation.js'

/** Lo único que nos interesa del ID token de Firebase. */
export interface FirebaseIdentity {
  uid: string
  email: string | null
}

/**
 * Verifica el ID token que emite Firebase Auth al hacer login.
 *
 * No usa `firebase-admin`: eso exigiría una llave de cuenta de servicio en cada
 * ambiente para hacer algo que es verificar una firma contra un JWKS público.
 *
 * El emulador firma con `alg: none` y no expone JWKS, así que en local se decodifica
 * sin verificar. Eso es seguro solo porque el emulador vive en localhost: si esta
 * rama se activara en la nube, cualquiera se haría pasar por cualquiera.
 */
@Injectable()
export class FirebaseTokenService {
  private readonly logger = new Logger(FirebaseTokenService.name)
  private readonly issuer: string
  private readonly audience: string
  private readonly isEmulator: boolean
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null

  constructor(config: ConfigService<Env, true>) {
    this.issuer = config.get('AUTH_ISSUER_URL', { infer: true })
    this.audience = config.get('AUTH_AUDIENCE', { infer: true })
    this.isEmulator = this.issuer.includes('localhost') || this.issuer.includes('127.0.0.1')

    this.jwks = this.isEmulator
      ? null
      : createRemoteJWKSet(
          new URL(
            'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
          ),
        )

    if (this.isEmulator) {
      this.logger.warn('Emulador de Firebase: los ID tokens NO se verifican')
    }
  }

  async verify(idToken: string): Promise<FirebaseIdentity> {
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
