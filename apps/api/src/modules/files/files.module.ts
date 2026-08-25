import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module.js'

import { FilesController } from './files.controller.js'
import { FilesService } from './files.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
