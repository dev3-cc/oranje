import { Global, Module } from '@nestjs/common'

import { MessagingPlatformService } from './messaging-platform.service.js'

@Global()
@Module({
  providers: [MessagingPlatformService],
  exports: [MessagingPlatformService],
})
export class MessagingPlatformModule {}
