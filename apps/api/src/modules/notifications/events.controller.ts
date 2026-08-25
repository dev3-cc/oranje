import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common'

import { Public } from '../../common/decorators/index.js'

import { PubSubPushDto, notificationEventSchema } from './dto/event.dto.js'
import { NotificationsService } from './notifications.service.js'
import type { FanOutResult } from './notifications.service.js'
import { PubSubTokenService } from './pubsub-token.service.js'

// Lo llama Pub/Sub, no una persona: @Public salta el guard de sesión y el token
// OIDC de Google es lo que autentica.
//
// Responde 200 incluso a un evento que no se pudo procesar por su contenido.
// Un 500 hace que Pub/Sub reintente, y un evento mal formado se va a reintentar
// igual de mal hasta agotar la suscripción.
@Controller('notifications/events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name)

  constructor(
    private readonly notifications: NotificationsService,
    private readonly tokens: PubSubTokenService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() dto: PubSubPushDto,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<{ data: FanOutResult | { ignored: string } }> {
    await this.tokens.verify(authorization)

    const parsed = notificationEventSchema.safeParse(decode(dto.message.data))

    if (!parsed.success) {
      this.logger.error(
        `Evento descartado (${dto.message.messageId ?? 'sin id'}): ${parsed.error.message}`,
      )

      return { data: { ignored: 'EVENT_MALFORMED' } }
    }

    try {
      return { data: await this.notifications.fanOut(parsed.data) }
    } catch (error) {
      this.logger.error(`Fan-out falló para ${parsed.data.type}: ${String(error)}`)

      throw error
    }
  }
}

function decode(data: string): unknown {
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
  } catch {
    return null
  }
}
