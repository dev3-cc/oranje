import { Module } from '@nestjs/common'

import { ConfigModule } from './config/config.module.js'
import { CPanelModule } from './infra/cpanel/index.js'
import { FirebaseModule } from './infra/firebase/index.js'
import { HealthModule } from './infra/health/index.js'
import { MailerModule } from './infra/mailer/index.js'
import { PlacesModule } from './infra/places/index.js'
import { PrismaModule } from './infra/prisma/index.js'
import { PubSubModule } from './infra/pubsub/index.js'
import { SettingsModule } from './infra/settings/index.js'
import { StorageModule } from './infra/storage/index.js'
import { CatalogsModule } from './modules/catalogs/index.js'
import { CommercialModule } from './modules/commercial/index.js'
import { CoverageModule } from './modules/coverage/index.js'
import { DemandModule } from './modules/demand/index.js'
import { FilesModule } from './modules/files/index.js'
import { IdentityModule } from './modules/identity/index.js'
import { NotificationsModule } from './modules/notifications/index.js'
import { ObservabilityModule } from './modules/observability/index.js'
import { OperationsModule } from './modules/operations/index.js'
import { PersonalModule } from './modules/personal/index.js'
import { AppSettingsModule } from './modules/settings/index.js'
import { SettlementModule } from './modules/settlement/index.js'
import { SupervisionModule } from './modules/supervision/index.js'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
    PubSubModule,
    PlacesModule,
    CPanelModule,
    FirebaseModule,
    SettingsModule,
    MailerModule,
    HealthModule,
    CatalogsModule,
    IdentityModule,
    CommercialModule,
    DemandModule,
    CoverageModule,
    OperationsModule,
    PersonalModule,
    SettlementModule,
    FilesModule,
    NotificationsModule,
    SupervisionModule,
    ObservabilityModule,
    AppSettingsModule,
  ],
})
export class AppModule {}
