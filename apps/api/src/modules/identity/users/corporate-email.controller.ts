import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'

import { Requires } from '../../../common/decorators/index.js'

import { CorporateEmailService } from './corporate-email.service.js'
import type { CorporateEmailRow, MailboxCredential } from './entities/corporate-email.entity.js'

/** El buzón real en cPanel de un correo corporativo que el colaborador ya tiene en Oranje. */
@Controller('corporate-email')
export class CorporateEmailController {
  constructor(private readonly service: CorporateEmailService) {}

  @Requires('users', 'manage_corporate_email')
  @Get()
  async list(): Promise<{ data: CorporateEmailRow[] }> {
    return { data: await this.service.list() }
  }

  @Requires('users', 'manage_corporate_email')
  @Post(':workerId/mailbox')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ): Promise<{ data: MailboxCredential }> {
    return { data: await this.service.createMailbox(workerId) }
  }

  @Requires('users', 'manage_corporate_email')
  @Post(':workerId/mailbox/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ): Promise<{ data: MailboxCredential }> {
    return { data: await this.service.resetPassword(workerId) }
  }

  @Requires('users', 'manage_corporate_email')
  @Delete(':workerId/mailbox')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('workerId', ParseUUIDPipe) workerId: string): Promise<void> {
    await this.service.deleteMailbox(workerId)
  }
}
