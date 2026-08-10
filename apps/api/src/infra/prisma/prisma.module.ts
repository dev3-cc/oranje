import { Global, Module } from '@nestjs/common'

import { PrismaService } from './prisma.service.js'

/**
 * Global a propósito: los 10 módulos de D-01 corren en un solo desplegable
 * contra una sola base, así que importar PrismaModule en cada uno sería
 * ceremonia sin beneficio.
 *
 * Lo que sí sigue prohibido: un módulo no consulta las tablas de otro. Esa
 * frontera la sostiene la revisión de código, no el contenedor de inyección.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
