import { Module } from '@nestjs/common'

import { WorkersController } from './workers/workers.controller.js'
import { WorkersRepository } from './workers/workers.repository.js'
import { WorkersService } from './workers/workers.service.js'

@Module({
  controllers: [WorkersController],
  providers: [WorkersService, WorkersRepository],
  exports: [WorkersService],
})
export class PersonalModule {}
