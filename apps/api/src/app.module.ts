import { Module } from '@nestjs/common'

import { ConfigModule } from './config/config.module.js'
import { HealthModule } from './infra/health/index.js'
import { PrismaModule } from './infra/prisma/index.js'
import { CatalogsModule } from './modules/catalogs/index.js'
import { CommercialModule } from './modules/commercial/index.js'
import { CoverageModule } from './modules/coverage/index.js'
import { DemandModule } from './modules/demand/index.js'
import { IdentityModule } from './modules/identity/index.js'
import { OperationsModule } from './modules/operations/index.js'
import { PersonalModule } from './modules/personal/index.js'
import { SettlementModule } from './modules/settlement/index.js'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    CatalogsModule,
    IdentityModule,
    CommercialModule,
    DemandModule,
    CoverageModule,
    OperationsModule,
    PersonalModule,
    SettlementModule,
  ],
})
export class AppModule {}
