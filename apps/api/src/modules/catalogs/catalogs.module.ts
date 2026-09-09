import { Module } from '@nestjs/common'

import { AuditChecklistItemsController } from './manage/audit-checklist-items/audit-checklist-items.controller.js'
import { AuditChecklistItemsService } from './manage/audit-checklist-items/audit-checklist-items.service.js'
import { ManageCatalogsController } from './manage/manage-catalogs.controller.js'
import { ManageCatalogsService } from './manage/manage-catalogs.service.js'
import { CatalogsController } from './read/catalogs.controller.js'
import { CatalogsService } from './read/catalogs.service.js'

@Module({
  controllers: [CatalogsController, ManageCatalogsController, AuditChecklistItemsController],
  providers: [CatalogsService, ManageCatalogsService, AuditChecklistItemsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
