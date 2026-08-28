import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleAuth } from 'google-auth-library'

// El mismo patrón que PushService: sin firebase-admin, la REST de Google con
// el token de las credenciales de servicio ya configuradas (en Cloud Run sale
// solo; en local, igual que FCM).
const SCOPES = [
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/cloud-platform',
]

const BASE = 'https://identitytoolkit.googleapis.com/v1'

/** Error de Identity Toolkit con su código (`EMAIL_EXISTS`, …) a la mano. */
export class FirebaseAccountsError extends Error {
  constructor(readonly code: string) {
    super(`Identity Toolkit respondió ${code}`)
  }
}

@Injectable()
export class FirebaseAccountsService {
  private readonly logger = new Logger(FirebaseAccountsService.name)
  private readonly projectId: string | undefined
  private readonly quotaProject: string | undefined
  private readonly auth = new GoogleAuth({ scopes: SCOPES })

  constructor(config: ConfigService<Record<string, unknown>, true>) {
    this.projectId = config.get<string>('FIREBASE_PROJECT_ID')
    this.quotaProject = config.get<string>('GOOGLE_CLOUD_QUOTA_PROJECT')
  }

  /**
   * Crea la cuenta en Firebase Auth. Sin `password`, la cuenta nace sin
   * credencial y la persona pone la suya vía el correo de restablecimiento.
   * `already_exists` NO es excepción: quien llama decide si lo tolera (alta
   * por invitación) o lo rechaza (alta con contraseña).
   */
  async createAccount(email: string, password?: string): Promise<'created' | 'already_exists'> {
    try {
      await this.call(`projects/${this.project()}/accounts`, {
        email,
        ...(password !== undefined ? { password } : {}),
      })

      return 'created'
    } catch (error) {
      if (error instanceof FirebaseAccountsError && error.code === 'EMAIL_EXISTS') {
        return 'already_exists'
      }

      throw error
    }
  }

  /**
   * Dispara el correo de restablecimiento de contraseña. Sin `returnOobLink`
   * a propósito: así Firebase manda su propio correo (plantilla en español se
   * ajusta en consola) y el enlace jamás pasa por aquí.
   */
  async sendPasswordReset(email: string): Promise<void> {
    await this.call(`projects/${this.project()}/accounts:sendOobCode`, {
      requestType: 'PASSWORD_RESET',
      email,
    })
  }

  private project(): string {
    if (!this.projectId) {
      throw new FirebaseAccountsError('FIREBASE_PROJECT_ID_MISSING')
    }

    return this.projectId
  }

  // Con credenciales de usuario —el ADC de una maquina local— Identity Toolkit
  // exige `x-goog-user-project` y sin el responde 403. En Cloud Run la cuenta
  // va adjunta, no hay quota project y el header sobra: por eso alla funcionaba
  // y aqui no.
  //
  // Sale del env y no de `auth.getClient()` porque esa llamada resuelve las
  // credenciales, y en CI no hay ninguna.
  private async call(path: string, body: Record<string, unknown>): Promise<void> {
    const token = await this.auth.getAccessToken()

    const response = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${String(token)}`,
        'content-type': 'application/json',
        ...(this.quotaProject ? { 'x-goog-user-project': this.quotaProject } : {}),
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      return
    }

    const code = await errorCode(response)

    this.logger.warn(`Identity Toolkit rechazó ${path.split('/').pop()}: ${code}`)

    throw new FirebaseAccountsError(code)
  }
}

/** Identity Toolkit responde `{ error: { message: 'EMAIL_EXISTS : …' } }`. */
async function errorCode(response: { status: number; json(): Promise<unknown> }): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } }
    const message = data.error?.message

    if (message) {
      return message.split(/[\s:]/, 1)[0] ?? message
    }
  } catch {
    // Cuerpo no-JSON: queda el status.
  }

  return `HTTP_${String(response.status)}`
}
