import { Module } from '@nestjs/common'

import { ConfigModule } from './config/config.module.js'
import { HealthModule } from './infra/health/index.js'
import { PrismaModule } from './infra/prisma/index.js'
import { CatalogsModule } from './modules/catalogs/index.js'
import { CommercialModule } from './modules/commercial/index.js'
import { IdentityModule } from './modules/identity/index.js'

/**
 * Monolito modular — D-01. Los 10 módulos de negocio son carpetas de
 * `src/modules/`, no servicios: `demand → coverage → operations` corren en una
 * sola transacción de Postgres, y esa unión es una regla de negocio (RR-15).
 *
 * Solo se registran los módulos cuyo esquema ya tiene tablas. Los otros siete
 * entran con su primera migración.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    CatalogsModule,
    IdentityModule,
    CommercialModule,
  ],
})
export class AppModule {}
