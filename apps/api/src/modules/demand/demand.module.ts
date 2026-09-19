import { Module } from '@nestjs/common'

import { RequisitionsModule } from './requisitions/requisitions.module.js'

@Module({
  imports: [RequisitionsModule],
})
export class DemandModule {}
