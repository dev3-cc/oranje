import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config/env.validation.js'

// UAPI de cPanel (no WHM): opera solo sobre la cuenta cuyo token se usa, que
// es justo lo que se quiere aqui — nunca acceso a otras cuentas del servidor.
const MODULE = 'Email'

export interface MailboxRow {
  login: string
  email: string
  suspendedLogin: boolean
}

export class CPanelError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join(' | '))
  }
}

interface UapiEnvelope<T> {
  status: number
  errors: string[] | null
  data: T | null
}

@Injectable()
export class CPanelService {
  private readonly logger = new Logger(CPanelService.name)
  private readonly host: string | undefined
  private readonly domain: string | undefined
  private readonly token: string | undefined

  constructor(config: ConfigService<Env, true>) {
    this.host = config.get('CPANEL_HOST', { infer: true })
    this.domain = config.get('CPANEL_DOMAIN', { infer: true })
    this.token = config.get('CPANEL_API_TOKEN', { infer: true })
  }

  get enabled(): boolean {
    return this.host !== undefined && this.domain !== undefined && this.token !== undefined
  }

  get domainName(): string {
    return this.domain ?? ''
  }

  async listMailboxes(): Promise<MailboxRow[]> {
    const body = await this.call<Array<{ login: string; email: string; suspended_login: number }>>(
      'list_pops',
      { domain: this.domain },
    )

    // La cuenta hostea varios dominios (D-XX): filtrar por el nuestro, siempre.
    return (body ?? [])
      .filter((row) => row.email.endsWith(`@${this.domain}`))
      .map((row) => ({
        login: row.login,
        email: row.email,
        suspendedLogin: row.suspended_login === 1,
      }))
  }

  async createMailbox(localPart: string, password: string): Promise<void> {
    await this.call('add_pop', {
      domain: this.domain,
      email: localPart,
      password,
      quota: 0,
    })
  }

  async resetPassword(localPart: string, password: string): Promise<void> {
    await this.call('passwd_pop', {
      domain: this.domain,
      email: localPart,
      password,
    })
  }

  async deleteMailbox(localPart: string): Promise<void> {
    await this.call('delete_pop', {
      domain: this.domain,
      email: localPart,
    })
  }

  private async call<T>(
    fn: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T | null> {
    if (!this.enabled) {
      throw new CPanelError(['cPanel no está configurado (faltan CPANEL_HOST/DOMAIN/API_TOKEN)'])
    }

    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value))
    }

    const response = await fetch(
      `https://${this.host}/execute/${MODULE}/${fn}?${query.toString()}`,
      {
        headers: { Authorization: `cpanel ${this.token}` },
      },
    )

    if (!response.ok) {
      this.logger.warn(`cPanel ${fn} respondió HTTP ${response.status}`)
      throw new CPanelError([`cPanel respondió HTTP ${response.status}`])
    }

    /*
     * cPanel contesta 200 con HTML —su pantalla de inicio de sesión— cuando no
     * acepta la credencial, y eso incluye el caso de un token válido llamado
     * desde una IP que el hosting no tiene autorizada. Sin esta comprobación,
     * `response.json()` reventaba con «Unexpected token '<'» y la pantalla
     * mostraba un 500 sin pista de qué había pasado.
     */
    const tipo = response.headers.get('content-type') ?? ''

    if (tipo.includes('text/html')) {
      this.logger.warn(`cPanel ${fn} devolvió HTML: la credencial no se aceptó desde esta IP`)
      throw new CPanelError([
        'cPanel no aceptó la conexión: devolvió su pantalla de inicio de sesión. ' +
          'Suele ser que la IP desde la que sale el servidor no está autorizada en el hosting.',
      ])
    }

    const envelope = (await response.json()) as UapiEnvelope<T>

    if (envelope.status !== 1) {
      const errors = envelope.errors ?? ['cPanel rechazó la operación sin detalle']
      this.logger.warn(`cPanel ${fn} falló: ${errors.join(' | ')}`)
      throw new CPanelError(errors)
    }

    return envelope.data
  }
}
