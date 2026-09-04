import { Module } from '@nestjs/common'

import { ManageCatalogsController } from './manage/manage-catalogs.controller.js'
import { ManageCatalogsService } from './manage/manage-catalogs.service.js'
import { CatalogsController } from './read/catalogs.controller.js'
import { CatalogsService } from './read/catalogs.service.js'

@Module({
  controllers: [CatalogsController, ManageCatalogsController],
  providers: [CatalogsService, ManageCatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
