import { Module } from '@nestjs/common'

import { IdentityModule } from '../../identity/index.js'

import { RequisitionsController } from './requisitions.controller.js'
import { RequisitionsRepository } from './requisitions.repository.js'
import { RequisitionsService } from './requisitions.service.js'

@Module({
  imports: [IdentityModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService, RequisitionsRepository],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
