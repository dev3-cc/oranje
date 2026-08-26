import { Global, Module } from '@nestjs/common'

import { PlacesService } from './places.service.js'

@Global()
@Module({
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
