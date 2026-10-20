import { Module } from '@nestjs/common'

import { ContractsModule } from '../../commercial/contracts/contracts.module.js'
import { IdentityModule } from '../../identity/index.js'
import { NotificationsModule } from '../../notifications/index.js'

import { RequisitionsController } from './requisitions.controller.js'
import { RequisitionsRepository } from './requisitions.repository.js'
import { RequisitionsService } from './requisitions.service.js'

@Module({
  // ContractsModule: Requisición solo deja pedir lo que el contrato vigente
  // del hotel cotizó (2026-10-17) — ver `RequisitionsService.assertContracted`.
  imports: [IdentityModule, NotificationsModule, ContractsModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService, RequisitionsRepository],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
