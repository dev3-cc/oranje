import { Global, Module } from '@nestjs/common'

import { CPanelService } from './cpanel.service.js'

@Global()
@Module({
  providers: [CPanelService],
  exports: [CPanelService],
})
export class CPanelModule {}
