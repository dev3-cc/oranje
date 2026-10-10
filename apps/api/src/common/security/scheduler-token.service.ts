import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_DE_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUER = 'https://accounts.google.com'

/**
 * Lo que llama el programador de tareas no es una persona: no hay sesión que
 * valga, y lo que lo identifica es el token OIDC que firma Google.
 *
 * Es gemelo de `PubSubTokenService` y vive aparte a propósito: tiene OTRA
 * audiencia y OTRA cuenta de servicio, y juntarlos en un verificador
 * compartido es un refactor de dos módulos que no cabe en este cambio. Si
 * aparece un tercero, entonces sí conviene unificarlos.
 *
 * Sin configurar, el endpoint responde 401: es preferible que el barrido no
 * corra a que lo pueda disparar cualquiera que conozca la ruta.
 */
@Injectable()
export class SchedulerTokenService {
  private readonly logger = new Logger(SchedulerTokenService.name)
  private readonly audience: string | undefined
  private readonly serviceAccount: string | undefined
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null

  constructor(config: ConfigService<Record<string, unknown>, true>) {
    this.audience = config.get<string>('SCHEDULER_AUDIENCE')
    this.serviceAccount = config.get<string>('SCHEDULER_SERVICE_ACCOUNT')
    this.jwks = this.audience ? createRemoteJWKSet(new URL(JWKS_DE_GOOGLE)) : null

    if (!this.audience) {
      this.logger.warn('Sin SCHEDULER_AUDIENCE: el barrido programado responderá 401')
    }
  }

  async verify(header: string | undefined): Promise<void> {
    if (!this.jwks || !this.audience) {
      throw new UnauthorizedException({
        code: 'SCHEDULER_NOT_CONFIGURED',
        message: 'El barrido programado no está configurado en este ambiente',
      })
    }

    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null

    if (!token) {
      throw new UnauthorizedException({
        code: 'SCHEDULER_TOKEN_MISSING',
        message: 'Falta el token OIDC del programador',
      })
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: ISSUER,
        audience: this.audience,
      })

      /* La firma solo prueba que lo emitió Google: sin esto vale el token de
         cualquier cuenta que apunte a esta audiencia. */
      if (this.serviceAccount && payload['email'] !== this.serviceAccount) {
        throw new Error(`cuenta inesperada: ${String(payload['email'])}`)
      }
    } catch (error) {
      this.logger.warn(`Token del programador rechazado: ${String(error)}`)

      throw new UnauthorizedException({
        code: 'SCHEDULER_TOKEN_INVALID',
        message: 'El token OIDC no es válido para este endpoint',
      })
    }
  }
}
