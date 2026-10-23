import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'

import { Requires } from '../../../common/decorators/index.js'

import { WorkersMessagingSyncService } from './workers-messaging-sync.service.js'
import type { WorkersMessagingSyncResult } from './workers-messaging-sync.service.js'
import type { WorkersMessagingSyncStatus } from './workers-messaging-sync.service.js'

/**
 * Con el permiso del Pool completo: se sincroniza a TODOS los colaboradores, y
 * solo Reclutamiento y QA ven sus teléfonos.
 */
@Controller('workers')
export class WorkersMessagingController {
  constructor(private readonly sync: WorkersMessagingSyncService) {}

  /* Dos segmentos: `GET workers/messaging-sync` lo tomaría `GET workers/:id`. */
  @Requires('recruitment', 'search_candidates')
  @Get('messaging-sync/status')
  async syncStatus(): Promise<{ data: WorkersMessagingSyncStatus }> {
    return { data: await this.sync.status() }
  }

  @Requires('recruitment', 'search_candidates')
  @Post('messaging-sync')
  @HttpCode(HttpStatus.OK)
  async syncToMessaging(): Promise<{ data: WorkersMessagingSyncResult }> {
    return { data: await this.sync.sync() }
  }
}
