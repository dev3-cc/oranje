import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleAuth } from 'google-auth-library'

import { PrismaService } from '../../infra/prisma/index.js'

import type { NotificationEvent } from './dto/event.dto.js'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
// Cuando FCM dice que el token ya no sirve. Cualquier otro error es transitorio
// y no justifica revocar el dispositivo de alguien.
const DEAD_TOKEN = new Set(['UNREGISTERED', 'INVALID_ARGUMENT'])

export interface PushResult {
  sent: number
  error: string | null
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)
  private readonly projectId: string | undefined
  private readonly auth = new GoogleAuth({ scopes: SCOPE })

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Record<string, unknown>, true>,
  ) {
    this.projectId = config.get<string>('FIREBASE_PROJECT_ID')
  }

  async send(userId: string, event: NotificationEvent): Promise<PushResult> {
    const devices = await this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, fcmToken: true },
    })

    if (devices.length === 0 || !this.projectId) {
      return { sent: 0, error: this.projectId ? null : 'FIREBASE_PROJECT_ID sin configurar' }
    }

    let sent = 0
    let firstError: string | null = null

    for (const device of devices) {
      const error = await this.sendOne(device.fcmToken, event)

      if (error === null) {
        sent += 1
        continue
      }

      firstError ??= error

      if (DEAD_TOKEN.has(error)) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { revokedAt: new Date() },
        })
      }
    }

    return { sent, error: sent > 0 ? null : firstError }
  }

  private async sendOne(token: string, event: NotificationEvent): Promise<string | null> {
    try {
      const client = await this.auth.getClient()
      const response = await client.request<unknown>({
        url: `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        method: 'POST',
        data: {
          message: {
            token,
            notification: { title: event.title, body: event.body },
            // El payload va como cadenas: FCM no acepta otra cosa en `data`.
            data: {
              type: event.type,
              ...(event.entity ? { entityType: event.entity.type, entityId: event.entity.id } : {}),
            },
          },
        },
      })

      void response

      return null
    } catch (error) {
      const code = errorCode(error)

      this.logger.warn(`FCM rechazo un token: ${code}`)

      return code
    }
  }
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { error?: { status?: string } } } }).response?.data

    if (data?.error?.status) {
      return data.error.status
    }
  }

  return error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN'
}
