import { Global, Module } from '@nestjs/common'

import { PrismaService } from './prisma.service.js'

// Global: los 10 módulos corren en un solo desplegable contra una sola base.
// Lo que sigue prohibido es que un módulo consulte las tablas de otro.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
