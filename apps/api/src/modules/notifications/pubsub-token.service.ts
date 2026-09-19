import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_DE_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUER = 'https://accounts.google.com'

// El endpoint de eventos no lo llama una persona, asi que no hay sesion que
// valga: lo llama Pub/Sub, y lo que lo identifica es el OIDC token que firma
// Google. Sin esto, cualquiera que conozca la ruta puede mandarle un push a
// quien quiera.
@Injectable()
export class PubSubTokenService {
  private readonly logger = new Logger(PubSubTokenService.name)
  private readonly audience: string | undefined
  private readonly serviceAccount: string | undefined
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null

  constructor(config: ConfigService<Record<string, unknown>, true>) {
    this.audience = config.get<string>('PUBSUB_AUDIENCE')
    this.serviceAccount = config.get<string>('PUBSUB_SERVICE_ACCOUNT')
    this.jwks = this.audience ? createRemoteJWKSet(new URL(JWKS_DE_GOOGLE)) : null

    if (!this.audience) {
      this.logger.warn('Sin PUBSUB_AUDIENCE: POST /notifications/events responderá 401')
    }
  }

  async verify(header: string | undefined): Promise<void> {
    if (!this.jwks || !this.audience) {
      throw new UnauthorizedException({
        code: 'PUBSUB_NOT_CONFIGURED',
        message: 'El consumidor de eventos no está configurado en este ambiente',
      })
    }

    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null

    if (!token) {
      throw new UnauthorizedException({
        code: 'PUBSUB_TOKEN_MISSING',
        message: 'Falta el token OIDC de Pub/Sub',
      })
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: ISSUER,
        audience: this.audience,
      })

      // La firma solo prueba que Google lo emitio; sin esto vale el token de
      // cualquier cuenta de Google que apunte a esta audiencia.
      if (this.serviceAccount && payload['email'] !== this.serviceAccount) {
        throw new Error(`cuenta inesperada: ${String(payload['email'])}`)
      }
    } catch (error) {
      this.logger.warn(`Token de Pub/Sub rechazado: ${String(error)}`)

      throw new UnauthorizedException({
        code: 'PUBSUB_TOKEN_INVALID',
        message: 'El token OIDC no es válido para este endpoint',
      })
    }
  }
}
