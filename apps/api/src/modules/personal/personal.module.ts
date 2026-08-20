import { Module } from '@nestjs/common'

import { DocumentsController } from './documents/documents.controller.js'
import { DocumentsRepository } from './documents/documents.repository.js'
import { DocumentsService } from './documents/documents.service.js'
import { RatesController } from './rates/rates.controller.js'
import { RatesRepository } from './rates/rates.repository.js'
import { RatesService } from './rates/rates.service.js'
import { WorkersController } from './workers/workers.controller.js'
import { WorkersRepository } from './workers/workers.repository.js'
import { WorkersService } from './workers/workers.service.js'

@Module({
  controllers: [WorkersController, DocumentsController, RatesController],
  providers: [
    WorkersService,
    WorkersRepository,
    DocumentsService,
    DocumentsRepository,
    RatesService,
    RatesRepository,
  ],
  exports: [WorkersService, DocumentsService, RatesService],
})
export class PersonalModule {}
