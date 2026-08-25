import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'

import { IdentityModule } from '../identity/index.js'

import { DocumentsController } from './documents/documents.controller.js'
import { DocumentsRepository } from './documents/documents.repository.js'
import { DocumentsService } from './documents/documents.service.js'
import { MeController } from './me/me.controller.js'
import { MeService } from './me/me.service.js'
import { TaxDeadlineGuard } from './me/tax-deadline.guard.js'
import { TaxDeadlineService } from './me/tax-deadline.service.js'
import { RatesController } from './rates/rates.controller.js'
import { RatesRepository } from './rates/rates.repository.js'
import { RatesService } from './rates/rates.service.js'
import { WorkersController } from './workers/workers.controller.js'
import { WorkersRepository } from './workers/workers.repository.js'
import { WorkersService } from './workers/workers.service.js'

@Module({
  imports: [IdentityModule],
  // MeController va primero: `workers/me` debe ganarle a `workers/:id`.
  controllers: [MeController, WorkersController, DocumentsController, RatesController],
  providers: [
    WorkersService,
    WorkersRepository,
    DocumentsService,
    DocumentsRepository,
    RatesService,
    RatesRepository,
    MeService,
    TaxDeadlineService,
    { provide: APP_GUARD, useClass: TaxDeadlineGuard },
  ],
  exports: [WorkersService, DocumentsService, RatesService, TaxDeadlineService],
})
export class PersonalModule {}
