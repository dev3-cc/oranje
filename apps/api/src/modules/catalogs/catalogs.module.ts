import { Module } from '@nestjs/common'

import { CatalogsController } from './read/catalogs.controller.js'
import { CatalogsService } from './read/catalogs.service.js'

@Module({
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
