import { Module } from '@nestjs/common'

import { DocumentsController } from './documents/documents.controller.js'
import { DocumentsRepository } from './documents/documents.repository.js'
import { DocumentsService } from './documents/documents.service.js'
import { WorkersController } from './workers/workers.controller.js'
import { WorkersRepository } from './workers/workers.repository.js'
import { WorkersService } from './workers/workers.service.js'

@Module({
  controllers: [WorkersController, DocumentsController],
  providers: [WorkersService, WorkersRepository, DocumentsService, DocumentsRepository],
  exports: [WorkersService, DocumentsService],
})
export class PersonalModule {}
