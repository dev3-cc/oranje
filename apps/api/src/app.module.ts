import { Module } from '@nestjs/common'

import { ConfigModule } from './config/config.module.js'

/**
 * Monolito modular — D-01. Los 10 módulos de negocio son carpetas de
 * `src/modules/`, no servicios: `demand → coverage → operations` corren en una
 * sola transacción de Postgres y esa unión es una regla de negocio (RR-15).
 *
 * Cada módulo se registra aquí a medida que se implementa. Orden de la Fase 2
 * del Plan de Implementación: catalogs → identity → commercial.
 */
@Module({
  imports: [ConfigModule],
})
export class AppModule {}
