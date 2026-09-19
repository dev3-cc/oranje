import { Module } from '@nestjs/common'

import { EventsController } from './events.controller.js'
import { NotificationsController } from './notifications.controller.js'
import { NotificationsService } from './notifications.service.js'
import { NotificationPublisherService } from './publisher.service.js'
import { PubSubTokenService } from './pubsub-token.service.js'
import { PushService } from './push.service.js'
import { RecipientsService } from './recipients.service.js'

// Sin IdentityModule en `imports`: ninguno de los providers de aquí usa
// PermissionsService ni nada de identity — `@Requires` lo cumple el guard
// global (APP_GUARD en AuthModule), que aplica en toda la app sin que cada
// módulo lo importe. Importarlo aquí cerraba un ciclo real (IdentityModule →
// UsersModule → NotificationsModule → IdentityModule) en cuanto
// StaffUsersService empezó a depender de NotificationPublisherService, y
// Nest no lo resolvía ni con forwardRef en las dos puntas (verificado con
// `Test.createTestingModule({ imports: [AppModule] })`).
@Module({
  imports: [],
  controllers: [NotificationsController, EventsController],
  providers: [
    NotificationsService,
    NotificationPublisherService,
    RecipientsService,
    PushService,
    PubSubTokenService,
  ],
  exports: [NotificationsService, NotificationPublisherService],
})
export class NotificationsModule {}
