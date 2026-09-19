import { Injectable, Logger } from '@nestjs/common'

import { PubSubService } from '../../infra/pubsub/index.js'

import type { NotificationEvent } from './dto/event.dto.js'
import { notificationEventSchema } from './dto/event.dto.js'

/**
 * Lo que usa CUALQUIER módulo de negocio para avisar "esto pasó" — publica
 * en Pub/Sub y `EventsController` (esta misma carpeta) lo recibe de vuelta
 * como push de Google, exactamente igual que si lo hubiera mandado otro
 * servicio. Un mismo esquema, `notificationEventSchema`, valida los dos
 * lados: lo que se publica es lo que el receptor espera.
 */
@Injectable()
export class NotificationPublisherService {
  private readonly logger = new Logger(NotificationPublisherService.name)

  constructor(private readonly pubsub: PubSubService) {}

  async publish(event: NotificationEvent): Promise<void> {
    const parsed = notificationEventSchema.safeParse(event)

    if (!parsed.success) {
      // Un evento mal armado es un bug de quien publica, no algo que deba
      // tumbar la acción de negocio que lo disparó.
      this.logger.error(`Evento inválido, no se publicó: ${parsed.error.message}`)
      return
    }

    await this.pubsub.publish(parsed.data)
  }
}
