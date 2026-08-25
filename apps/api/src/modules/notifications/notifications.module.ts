import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module.js'

import { EventsController } from './events.controller.js'
import { NotificationsController } from './notifications.controller.js'
import { NotificationsService } from './notifications.service.js'
import { PubSubTokenService } from './pubsub-token.service.js'
import { PushService } from './push.service.js'
import { RecipientsService } from './recipients.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [NotificationsController, EventsController],
  providers: [NotificationsService, RecipientsService, PushService, PubSubTokenService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
