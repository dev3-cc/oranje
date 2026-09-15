import { PubSub } from '@google-cloud/pubsub'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../config/env.validation.js'

/**
 * Cliente de Pub/Sub para el tema de notificaciones — no sabe nada de la
 * forma de un evento de negocio (eso lo valida quien publica, en su propio
 * módulo); aquí solo se manda el JSON.
 *
 * Sin `PUBSUB_TOPIC_NOTIFICATIONS` configurada, `publish()` no revienta —
 * solo avisa en el log y no manda nada, el mismo criterio que
 * `CPanelService.enabled`: mientras el tema no exista en GCP, el resto del
 * módulo sigue funcionando (crea filas, las lista, las marca leídas) y solo
 * el fan-out por evento queda en pausa.
 */
@Injectable()
export class PubSubService {
  private readonly logger = new Logger(PubSubService.name)
  private readonly topicName: string | undefined
  private client: PubSub | null = null

  constructor(config: ConfigService<Env, true>) {
    this.topicName = config.get('PUBSUB_TOPIC_NOTIFICATIONS', { infer: true })
  }

  get enabled(): boolean {
    return this.topicName !== undefined
  }

  async publish(data: Record<string, unknown>): Promise<void> {
    if (!this.topicName) {
      this.logger.warn('PUBSUB_TOPIC_NOTIFICATIONS no está configurada: el evento no se publicó')
      return
    }

    this.client ??= new PubSub()
    const messageId = await this.client
      .topic(this.topicName)
      .publishMessage({ data: Buffer.from(JSON.stringify(data)) })

    this.logger.log(`Publicado en ${this.topicName}: ${messageId}`)
  }
}
