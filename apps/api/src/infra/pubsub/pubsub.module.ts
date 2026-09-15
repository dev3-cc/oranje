import { Global, Module } from '@nestjs/common'

import { PubSubService } from './pubsub.service.js'

@Global()
@Module({
  providers: [PubSubService],
  exports: [PubSubService],
})
export class PubSubModule {}
